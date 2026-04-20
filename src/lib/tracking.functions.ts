import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { fetchTracking, refreshOneTracking } from "./tracking.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// Validate Brazilian tracking code format (Correios AA999999999BR or Total Express)
const CORREIOS_RE = /^[A-Z]{2}\d{9}[A-Z]{2}$/;

export const refreshTicketTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { ticketId: string }) => {
    if (!input?.ticketId) throw new Error("ticketId obrigatório");
    return input;
  })
  .handler(async ({ data }) => {
    const { data: row } = await supabaseAdmin
      .from("ticket_tracking")
      .select("id, ticket_id, tracking_code, is_delivered")
      .eq("ticket_id", data.ticketId)
      .maybeSingle();
    if (!row) return { ok: false, error: "Sem código de rastreio para esse ticket" };
    const res = await refreshOneTracking(row);
    return res;
  });

export const previewTracking = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string }) => {
    const code = (input?.code || "").trim().toUpperCase();
    if (!code) throw new Error("Código obrigatório");
    return { code };
  })
  .handler(async ({ data }) => {
    if (!CORREIOS_RE.test(data.code)) {
      return { ok: false, error: "Formato inválido. Use AA123456789BR" };
    }
    try {
      const result = await fetchTracking(data.code);
      return { ok: true, result };
    } catch (e: any) {
      return { ok: false, error: e?.message || "Falha ao consultar" };
    }
  });
