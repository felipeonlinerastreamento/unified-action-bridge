import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth.server";
import { collectSystemHealth } from "@/lib/system-health.server";

type Issue = { key: string; severity: "warning" | "critical"; title: string; message: string };

function mb(bytes: number) {
  return Math.round(bytes / (1024 * 1024));
}

async function notifyManagers(issue: Issue) {
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["admin", "gestor"]);
  const ids = [...new Set(((roles || []) as any[]).map((r) => r.user_id))];
  if (!ids.length) return;

  const { data: actives } = await supabaseAdmin
    .from("profiles")
    .select("user_id, is_active")
    .in("user_id", ids);
  const targets = ((actives || []) as any[]).filter((p) => p.is_active !== false).map((p) => p.user_id);
  if (!targets.length) return;

  await supabaseAdmin.from("notifications").insert(
    targets.map((user_id) => ({
      user_id,
      type: "system_health",
      title: issue.title,
      message: issue.message,
      metadata: { alert_key: issue.key, severity: issue.severity } as any,
    })) as any,
  );
}

async function runScan() {
  const health = await collectSystemHealth(true);
  const s = health.settings || {};
  const connWarn = Number(s.connections_pct_warn ?? 80);
  const cacheMin = Number(s.cache_hit_min_pct ?? 95);
  const growthLimitMb = Number(s.db_growth_limit_mb ?? 2048);
  const staleMin = Number(s.cron_stale_minutes ?? 15);
  const errPerHour = Number(s.integration_errors_per_hour ?? 10);
  const alertsEnabled = s.alerts_enabled !== false;
  const muted = s.muted_until ? new Date(s.muted_until).getTime() > Date.now() : false;

  // Snapshot para acompanhar crescimento
  await supabaseAdmin.from("system_health_snapshots").insert({
    db_size_bytes: health.db.sizeBytes,
    connections: health.db.connections,
    max_connections: health.db.maxConnections,
    cache_hit_pct: health.db.cacheHitPct,
    metrics: { queues: health.queues, failures24h: health.failures.last24h } as any,
  } as any);

  const issues: Issue[] = [];

  if (health.db.ok) {
    if (health.db.connectionsPct >= connWarn) {
      issues.push({
        key: "db_connections",
        severity: health.db.connectionsPct >= 95 ? "critical" : "warning",
        title: "Banco de dados com muitas conexões",
        message: `${health.db.connections} de ${health.db.maxConnections} conexões em uso (${health.db.connectionsPct}%).`,
      });
    }
    if (health.db.cacheHitPct < cacheMin) {
      issues.push({
        key: "db_cache",
        severity: "warning",
        title: "Banco lendo muito do disco",
        message: `Apenas ${health.db.cacheHitPct}% das leituras vêm da memória (mínimo esperado ${cacheMin}%).`,
      });
    }
    if (health.db.sizeGrowth7dBytes !== null && mb(health.db.sizeGrowth7dBytes) >= growthLimitMb) {
      issues.push({
        key: "db_growth",
        severity: "warning",
        title: "Crescimento acelerado do banco",
        message: `O banco cresceu ${mb(health.db.sizeGrowth7dBytes)} MB nos últimos 7 dias.`,
      });
    }
  } else {
    issues.push({
      key: "db_unreachable",
      severity: "critical",
      title: "Não foi possível medir o banco de dados",
      message: health.db.error || "Falha ao ler os indicadores do banco.",
    });
  }

  for (const job of health.cron.rows) {
    const name = job.jobname || `job ${job.jobid}`;
    const last = job.last_run ? new Date(job.last_run).getTime() : 0;
    const minuteJob = String(job.schedule || "").includes("* * * * *");
    if (job.last_status && job.last_status !== "succeeded") {
      issues.push({
        key: `cron_fail_${job.jobid}`,
        severity: "critical",
        title: `Rotina automática com falha: ${name}`,
        message: job.last_message || "A última execução não foi concluída com sucesso.",
      });
    } else if (minuteJob && (!last || Date.now() - last > staleMin * 60_000)) {
      issues.push({
        key: `cron_stale_${job.jobid}`,
        severity: "warning",
        title: `Rotina automática parada: ${name}`,
        message: last
          ? `Última execução em ${new Date(last).toLocaleString("pt-BR")}.`
          : "Ainda não há registro de execução.",
      });
    }
  }

  for (const integ of health.integrations) {
    if (integ.status === "down") {
      issues.push({
        key: `integration_${integ.key}`,
        severity: "critical",
        title: `Integração fora do ar: ${integ.label}`,
        message: integ.detail,
      });
    }
  }

  if (health.failures.last24h >= errPerHour * 24) {
    issues.push({
      key: "integration_errors",
      severity: "warning",
      title: "Muitas falhas de integração",
      message: `${health.failures.last24h} falhas registradas nas últimas 24 horas.`,
    });
  }

  // Estado atual dos alertas
  const { data: openRows } = await supabaseAdmin
    .from("system_health_alert_log")
    .select("id, alert_key")
    .eq("is_open", true);
  const open = new Map(((openRows || []) as any[]).map((r) => [r.alert_key, r.id]));
  const currentKeys = new Set(issues.map((i) => i.key));

  let created = 0;
  for (const issue of issues) {
    if (open.has(issue.key)) {
      await supabaseAdmin
        .from("system_health_alert_log")
        .update({ last_seen_at: new Date().toISOString(), message: issue.message } as any)
        .eq("id", open.get(issue.key));
      continue;
    }
    await supabaseAdmin.from("system_health_alert_log").insert({
      alert_key: issue.key,
      severity: issue.severity,
      title: issue.title,
      message: issue.message,
    } as any);
    created++;
    if (alertsEnabled && !muted) await notifyManagers(issue);
  }

  let resolved = 0;
  for (const [key, id] of open.entries()) {
    if (currentKeys.has(key)) continue;
    await supabaseAdmin
      .from("system_health_alert_log")
      .update({ is_open: false, resolved_at: new Date().toISOString() } as any)
      .eq("id", id);
    resolved++;
    if (alertsEnabled && !muted) {
      const { data: row } = await supabaseAdmin
        .from("system_health_alert_log")
        .select("title")
        .eq("id", id)
        .maybeSingle();
      await notifyManagers({
        key,
        severity: "warning",
        title: "Situação normalizada",
        message: `${(row as any)?.title || key} voltou ao normal.`,
      });
    }
  }

  return { ok: true, issues: issues.length, created, resolved, muted, alertsEnabled };
}

export const Route = createFileRoute("/api/public/system-health-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        try {
          const result = await runScan();
          return new Response(JSON.stringify(result), { headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ error: e?.message || String(e) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
      GET: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        return new Response("ok");
      },
    },
  },
});
