import { createServerFn } from "@tanstack/react-start";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { loadZapiChannel, zapiSendText } from "@/lib/zapi.server";
import { formatProtocol } from "@/lib/protocol-format";

const DirectionSchema = z.enum(["inbound", "outbound", "both"]);
const MatchModeSchema = z.enum(["any", "all"]);

function getServiceSupabase() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Supabase env vars missing");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function assertCanRead(userId: string) {
  const supabase = getServiceSupabase();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const set = new Set((roles || []).map((r) => r.role));
  if (set.has("admin") || set.has("gestor")) return;
  throw new Error("Sem permissão.");
}

async function assertAdmin(userId: string) {
  const supabase = getServiceSupabase();
  const { data: roles } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  const set = new Set((roles || []).map((r) => r.role));
  if (!set.has("admin")) throw new Error("Apenas administradores podem alterar.");
}

// ============================================================
// Settings get/update
// ============================================================

export const getNoCommSettings = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanRead(context.userId);
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from("no_comm_automation_settings")
      .select("*")
      .eq("singleton", true)
      .maybeSingle();
    return { settings: data };
  });

const UpdateSchema = z.object({
  is_enabled: z.boolean(),
  direction: DirectionSchema,
  footer_template: z
    .string()
    .min(5)
    .max(500)
    .refine((v) => v.includes("{numero do protocolo}"), {
      message: "O rodapé deve conter {numero do protocolo}",
    }),
  keywords: z.array(z.string().trim().min(3).max(120)).min(1).max(20),
  match_mode: MatchModeSchema,
  auto_close: z.boolean(),
  category: z.string().trim().min(1).max(80),
  final_status: z.enum(["finalizado"]).default("finalizado"),
});

export const updateNoCommSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => UpdateSchema.parse(input))
  .handler(async ({ data, context }) => {
    await assertAdmin(context.userId);
    if (data.is_enabled && data.keywords.length === 0) {
      throw new Error("Adicione ao menos uma palavra-chave para ativar.");
    }
    const supabase = getServiceSupabase();
    const { error } = await supabase
      .from("no_comm_automation_settings")
      .update({ ...data, updated_by: context.userId, updated_at: new Date().toISOString() })
      .eq("singleton", true);
    if (error) throw new Error(error.message);
    return { success: true };
  });

export const getNoCommRecentLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertCanRead(context.userId);
    const supabase = getServiceSupabase();
    const { data } = await supabase
      .from("no_comm_automation_log")
      .select("id, chat_id, protocol_number, direction, matched_keyword, message_excerpt, triggered_at")
      .order("triggered_at", { ascending: false })
      .limit(15);
    return { logs: data || [] };
  });

// ============================================================
// Core matching + processing (called server-side from webhook + sendText)
// ============================================================

function normalize(s: string): string {
  return s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

type NoCommSettings = {
  is_enabled: boolean;
  direction: "inbound" | "outbound" | "both";
  footer_template: string;
  keywords: string[];
  match_mode: "any" | "all";
  auto_close: boolean;
  category: string;
  final_status: string;
};

function matches(text: string, settings: NoCommSettings): string | null {
  const norm = normalize(text);
  const kws = (settings.keywords || []).map((k) => normalize(k)).filter(Boolean);
  if (!kws.length) return null;
  if (settings.match_mode === "all") {
    return kws.every((k) => norm.includes(k)) ? settings.keywords[0] : null;
  }
  const idx = kws.findIndex((k) => norm.includes(k));
  return idx >= 0 ? settings.keywords[idx] : null;
}

/**
 * Processa uma mensagem para a automação "Sem comunicação".
 * Chamado server-side (admin client) a partir do webhook Z-API (inbound/outbound).
 *
 * - direction='outbound': mensagem enviada por nós (operador ou eco do envio).
 * - direction='inbound': mensagem recebida do cliente.
 *
 * Idempotente por (chat_id, message_id).
 */
export async function processNoCommAutomation(
  admin: SupabaseClient,
  args: {
    chatId: string;
    channelId: string;
    messageId: string | null;
    direction: "inbound" | "outbound";
    text: string;
    contactPhone: string;
    contactName: string | null;
    assignedTo: string | null;
  },
): Promise<{ matched: boolean; protocol?: string; ticketId?: string }> {
  if (!args.text || !args.text.trim()) return { matched: false };

  const { data: settings } = await admin
    .from("no_comm_automation_settings")
    .select("*")
    .eq("singleton", true)
    .maybeSingle();
  const s = settings as NoCommSettings | null;
  if (!s || !s.is_enabled) return { matched: false };
  if (s.direction !== "both" && s.direction !== args.direction) return { matched: false };

  const matched = matches(args.text, s);
  if (!matched) return { matched: false };

  // Idempotência
  if (args.messageId) {
    const { data: existing } = await admin
      .from("no_comm_automation_log")
      .select("id")
      .eq("chat_id", args.chatId)
      .eq("message_id", args.messageId)
      .maybeSingle();
    if (existing) return { matched: false };
  }

  // Procura ticket aberto vinculado ao chat
  let ticket: { id: string; protocol_number: number | null } | null = null;
  {
    const { data } = await admin
      .from("service_tickets")
      .select("id, protocol_number")
      .eq("attendance_id", args.chatId)
      .neq("status", "finalizado")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (data) ticket = data as any;
  }

  // Se não houver, cria ticket já finalizado
  if (!ticket) {
    const { data: created, error: insErr } = await admin
      .from("service_tickets")
      .insert({
        attendance_id: args.chatId,
        channel_id: args.channelId || null,
        contact_phone: args.contactPhone || null,
        contact_name: args.contactName || null,
        status: "aberto",
        category: s.category,
        assigned_to: args.assignedTo || null,
        notes: `Comunicado automático "Sem comunicação" (${args.direction === "outbound" ? "enviado por nós" : "recebido do cliente"}).`,
      } as any)
      .select("id, protocol_number")
      .single();
    if (insErr) {
      console.warn("[no-comm] ticket insert error", insErr);
      return { matched: false };
    }
    ticket = created as any;
  }

  const protocol = formatProtocol(ticket!.protocol_number);
  const footer = s.footer_template.replace(/\{numero do protocolo\}/g, protocol);

  // Envia rodapé como mensagem separada
  try {
    const creds = await loadZapiChannel(admin, args.channelId);
    if (creds && args.contactPhone) {
      const result = await zapiSendText(creds, args.contactPhone, footer);
      await admin.from("zapi_messages").insert({
        chat_id: args.chatId,
        zapi_message_id: (result as any)?.messageId || (result as any)?.id || null,
        from_me: true,
        text: footer,
        status: "sent",
      });
    }
  } catch (err) {
    console.warn("[no-comm] failed to send footer", err);
  }

  // Fecha o chamado (se configurado)
  if (s.auto_close) {
    const noteSuffix = `\n[Automação] Comunicado "Sem comunicação" enviado. Protocolo: ${protocol}.`;
    await admin
      .from("service_tickets")
      .update({
        status: "finalizado",
        category: s.category,
        closed_at: new Date().toISOString(),
        notes: noteSuffix,
      } as any)
      .eq("id", ticket!.id);

    // Marca chat como finalizado também
    try {
      await admin
        .from("zapi_chats")
        .update({ status: "finalizado", closed_at: new Date().toISOString() } as any)
        .eq("id", args.chatId);
    } catch { /* ignore */ }
  }

  // Log
  await admin.from("no_comm_automation_log").insert({
    chat_id: args.chatId,
    message_id: args.messageId,
    ticket_id: ticket!.id,
    protocol_number: ticket!.protocol_number,
    direction: args.direction,
    matched_keyword: matched,
    message_excerpt: args.text.slice(0, 240),
    triggered_by: args.assignedTo,
  } as any);

  return { matched: true, protocol, ticketId: ticket!.id };
}
