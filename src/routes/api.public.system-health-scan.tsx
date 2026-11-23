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

  // Estado atual dos alertas. Contra falso positivo (ver src/lib/system-health-alerts.ts): avisa só depois de
  // `integration_fail_threshold` verificações seguidas com o problema, dá como normalizado só depois do mesmo
  // número de verificações boas, e um problema que oscilou nas últimas 6 h espera durar 1 h antes de avisar de novo.
  const { decidirAlertas } = await import("@/lib/system-health-alerts");
  const limite = Number(s.integration_fail_threshold ?? 2);
  const { data: openRows } = await supabaseAdmin
    .from("system_health_alert_log")
    .select("id, alert_key, title, opened_at, metadata")
    .eq("is_open", true);
  const abertos = ((openRows || []) as any[]).map((r) => ({ id: r.id, key: r.alert_key, opened_at: r.opened_at, metadata: r.metadata }));
  const { data: recentes } = await supabaseAdmin
    .from("system_health_alert_log")
    .select("alert_key, metadata")
    .eq("is_open", false)
    .gte("resolved_at", new Date(Date.now() - 6 * 3600_000).toISOString());
  const oscilaram = new Set(((recentes || []) as any[]).filter((r) => r.metadata?.notified).map((r) => r.alert_key as string));
  const porChave = new Map(issues.map((i) => [i.key, i]));
  const titulo = new Map(abertos.map((a) => [a.key, ((openRows || []) as any[]).find((r) => r.id === a.id)?.title]));

  let created = 0;
  let resolved = 0;
  for (const acao of decidirAlertas({ problemas: [...porChave.keys()], abertos, oscilaram, limite, agora: Date.now() })) {
    const issue = porChave.get(acao.key);
    if (acao.tipo === "abrir" && issue) {
      await supabaseAdmin.from("system_health_alert_log").insert({
        alert_key: issue.key, severity: issue.severity, title: issue.title, message: issue.message, metadata: acao.metadata,
      } as any);
      created++;
    } else if (acao.tipo === "atualizar") {
      await supabaseAdmin.from("system_health_alert_log")
        .update({ last_seen_at: new Date().toISOString(), metadata: acao.metadata, ...(issue ? { message: issue.message } : {}) } as any)
        .eq("id", acao.id);
    } else if (acao.tipo === "fechar") {
      await supabaseAdmin.from("system_health_alert_log").update({ is_open: false, resolved_at: new Date().toISOString() } as any).eq("id", acao.id);
      resolved++;
    }
    if (!acao.notificar || !alertsEnabled || muted) continue;
    if (acao.tipo === "fechar") {
      await notifyManagers({ key: acao.key, severity: "warning", title: "Situação normalizada", message: `${titulo.get(acao.key) || acao.key} voltou ao normal.` });
    } else if (issue) {
      await notifyManagers(issue);
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
