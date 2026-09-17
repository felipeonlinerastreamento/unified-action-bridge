import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureMonitor(context: any) {
  const { data: isAdmin } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "admin" });
  const { data: isGestor } = await context.supabase.rpc("has_role", { _user_id: context.userId, _role: "gestor" });
  if (!isAdmin && !isGestor) throw new Error("Acesso restrito a administradores e gestores.");
  return { isAdmin: !!isAdmin };
}

export const getSystemHealth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { force?: boolean } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    await ensureMonitor(context);
    const { collectSystemHealth, overallStatus } = await import("@/lib/system-health.server");
    const health = await collectSystemHealth(!!data.force);
    return { health, status: overallStatus(health) };
  });

const settingsSchema = z.object({
  connections_pct_warn: z.number().int().min(10).max(100),
  cache_hit_min_pct: z.number().min(50).max(100),
  db_growth_limit_mb: z.number().int().min(100).max(1000000),
  cron_stale_minutes: z.number().int().min(2).max(1440),
  integration_errors_per_hour: z.number().int().min(1).max(1000),
  alerts_enabled: z.boolean(),
  mute_hours: z.number().min(0).max(24).optional(),
});

export const saveSystemHealthSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => settingsSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { isAdmin } = await ensureMonitor(context);
    if (!isAdmin) throw new Error("Apenas administradores podem alterar os limites.");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const muted_until = data.mute_hours && data.mute_hours > 0
      ? new Date(Date.now() + data.mute_hours * 3600_000).toISOString()
      : null;

    const payload = {
      connections_pct_warn: data.connections_pct_warn,
      cache_hit_min_pct: data.cache_hit_min_pct,
      db_growth_limit_mb: data.db_growth_limit_mb,
      cron_stale_minutes: data.cron_stale_minutes,
      integration_errors_per_hour: data.integration_errors_per_hour,
      alerts_enabled: data.alerts_enabled,
      ...(data.mute_hours !== undefined ? { muted_until } : {}),
    };

    const { data: existing } = await supabaseAdmin.from("system_health_settings").select("id").limit(1).maybeSingle();
    if (existing?.id) {
      const { error } = await supabaseAdmin.from("system_health_settings").update(payload as any).eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabaseAdmin.from("system_health_settings").insert(payload as any);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

export const listSystemHealthAlerts = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await ensureMonitor(context);
    const { data, error } = await context.supabase
      .from("system_health_alert_log")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return data || [];
  });
