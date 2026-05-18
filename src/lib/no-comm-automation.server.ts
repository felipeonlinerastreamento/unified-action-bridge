import type { SupabaseClient } from "@supabase/supabase-js";
import { loadZapiChannel, zapiSendText } from "@/lib/zapi.server";
import { formatProtocol } from "@/lib/protocol-format";

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

  if (args.messageId) {
    const { data: existing } = await admin
      .from("no_comm_automation_log")
      .select("id")
      .eq("chat_id", args.chatId)
      .eq("message_id", args.messageId)
      .maybeSingle();
    if (existing) return { matched: false };
  }

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

    try {
      await admin
        .from("zapi_chats")
        .update({ status: "finalizado", closed_at: new Date().toISOString() } as any)
        .eq("id", args.chatId);
    } catch { /* ignore */ }
  }

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
