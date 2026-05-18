import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
