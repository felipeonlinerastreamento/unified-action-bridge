import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Internal helper: insert directly with admin client. Never throws. */
export async function writeAuditLog(params: {
  user_id?: string | null;
  user_name?: string | null;
  event_category: string;
  event_type: string;
  target_type?: string | null;
  target_id?: string | null;
  target_label?: string | null;
  metadata?: Record<string, unknown> | null;
  ip_address?: string | null;
  user_agent?: string | null;
}) {
  try {
    await supabaseAdmin.from("audit_logs").insert({
      user_id: params.user_id ?? null,
      user_name: params.user_name ?? null,
      event_category: params.event_category,
      event_type: params.event_type,
      action: params.event_type,
      entity_type: params.target_type ?? null,
      entity_id: params.target_id ?? null,
      target_type: params.target_type ?? null,
      target_id: params.target_id ?? null,
      target_label: params.target_label ?? null,
      details: (params.metadata ?? {}) as any,
      metadata: (params.metadata ?? {}) as any,
      ip_address: params.ip_address ?? null,
      user_agent: params.user_agent ?? null,
    } as any);
  } catch (err) {
    console.error("[audit] failed to write log", err);
  }
}

export { supabaseAdmin };
