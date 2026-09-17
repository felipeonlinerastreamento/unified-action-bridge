// Coleta de indicadores de saúde do sistema (banco, rotinas, integrações, filas).
// Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Status = "ok" | "warn" | "down" | "unknown";

export interface IntegrationCheck {
  key: string;
  label: string;
  status: Status;
  responseMs: number | null;
  detail: string;
}

export interface SystemHealth {
  generatedAt: string;
  db: {
    ok: boolean;
    error?: string;
    sizeBytes: number;
    sizeGrowth7dBytes: number | null;
    connections: number;
    activeConnections: number;
    idleInTransaction: number;
    maxConnections: number;
    connectionsPct: number;
    cacheHitPct: number;
    deadlocks: number;
    rollbacks: number;
    commits: number;
    tempFiles: number;
    tempBytes: number;
    startedAt: string | null;
    longestQuerySeconds: number;
  };
  cron: { available: boolean; error?: string; rows: any[] };
  slowQueries: { available: boolean; error?: string; rows: any[] };
  tables: { error?: string; rows: any[] };
  integrations: IntegrationCheck[];
  queues: {
    botPending: number;
    emailChannelsWithError: number;
    ticketsOpenOver24h: number;
    chatsWaitingOver1h: number;
  };
  failures: { last24h: number; last7d: number; byService: { service: string; count: number; lastError: string | null; lastAt: string | null }[] };
  settings: any;
}

const cache: { at: number; data: SystemHealth | null } = { at: 0, data: null };
const CACHE_MS = 60_000;

async function rpc(name: string): Promise<any> {
  const { data, error } = await (supabaseAdmin as any).rpc(name);
  if (error) throw new Error(error.message);
  return data;
}

async function timed(fn: () => Promise<string>): Promise<{ ms: number; detail: string; ok: boolean }> {
  const start = Date.now();
  try {
    const detail = await fn();
    return { ms: Date.now() - start, detail, ok: true };
  } catch (e: any) {
    return { ms: Date.now() - start, detail: e?.message || String(e), ok: false };
  }
}

async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 8000): Promise<Response> {
  return await fetch(url, { ...init, signal: AbortSignal.timeout(ms) });
}

async function checkZapi(): Promise<IntegrationCheck[]> {
  const out: IntegrationCheck[] = [];
  const { data: channels } = await supabaseAdmin
    .from("channels")
    .select("id, name, token, zapi_instance_id, zapi_client_token, is_active")
    .eq("is_active", true)
    .limit(5);

  for (const ch of (channels || []) as any[]) {
    if (!ch.zapi_instance_id || !ch.token) {
      out.push({ key: `zapi:${ch.id}`, label: `WhatsApp — ${ch.name}`, status: "unknown", responseMs: null, detail: "Canal ainda não configurado." });
      continue;
    }
    const r = await timed(async () => {
      const res = await fetchWithTimeout(
        `https://api.z-api.io/instances/${ch.zapi_instance_id}/token/${ch.token}/status`,
        { headers: ch.zapi_client_token ? { "Client-Token": ch.zapi_client_token } : {} },
      );
      const body: any = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || `Falha ${res.status}`);
      if (body?.connected === false) throw new Error("WhatsApp desconectado da instância.");
      return "Conectado.";
    });
    out.push({
      key: `zapi:${ch.id}`,
      label: `WhatsApp — ${ch.name}`,
      status: r.ok ? (r.ms > 3000 ? "warn" : "ok") : "down",
      responseMs: r.ms,
      detail: r.detail,
    });
  }
  return out;
}

async function checkSeuInstalador(): Promise<IntegrationCheck> {
  const key = process.env["SEU_INSTALADOR_INTEGRATION_API_KEY"];
  if (!key) {
    return { key: "seu-instalador", label: "Seu Instalador", status: "unknown", responseMs: null, detail: "Chave de acesso não configurada." };
  }
  const r = await timed(async () => {
    const res = await fetchWithTimeout("https://seuinstalador-com-br.lovable.app/api/public/integrations/v1/technicians", {
      headers: { "X-Integration-Key": key, "X-External-User-Name": "Monitoramento GS Hub", "X-Request-Id": crypto.randomUUID() },
    });
    if (!res.ok) throw new Error(`Resposta ${res.status}`);
    return "Respondendo normalmente.";
  });
  return { key: "seu-instalador", label: "Seu Instalador", status: r.ok ? (r.ms > 4000 ? "warn" : "ok") : "down", responseMs: r.ms, detail: r.detail };
}

async function checkTopGamific(): Promise<IntegrationCheck> {
  const key = process.env["TOPGAMIFIC_API_KEY"];
  if (!key) {
    return { key: "topgamific", label: "Top Gamific", status: "unknown", responseMs: null, detail: "Chave de acesso não configurada." };
  }
  const r = await timed(async () => {
    const res = await fetchWithTimeout(
      "https://jyukercrhruslahpqlqi.supabase.co/functions/v1/public-api/missions",
      { headers: { "x-api-key": key } },
    );
    if (!res.ok) throw new Error(`Resposta ${res.status}`);
    return "Respondendo normalmente.";
  });
  return { key: "topgamific", label: "Top Gamific", status: r.ok ? (r.ms > 4000 ? "warn" : "ok") : "down", responseMs: r.ms, detail: r.detail };
}

async function checkEmailChannels(): Promise<IntegrationCheck[]> {
  const { data: rows } = await supabaseAdmin
    .from("email_channels")
    .select("id, email_address, is_active, last_polled_at, last_poll_status, last_poll_error")
    .eq("is_active", true)
    .limit(10);

  return ((rows || []) as any[]).map((c) => {
    const last = c.last_polled_at ? new Date(c.last_polled_at).getTime() : 0;
    const stale = !last || Date.now() - last > 30 * 60_000;
    let status: Status = "ok";
    let detail = c.last_polled_at ? `Última verificação: ${new Date(c.last_polled_at).toLocaleString("pt-BR")}.` : "Ainda não verificada.";
    if (c.last_poll_status && c.last_poll_status !== "ok") {
      status = "down";
      detail = c.last_poll_error || "Falha na última verificação.";
    } else if (stale) {
      status = "warn";
      detail += " Sem verificação recente.";
    }
    return { key: `email:${c.id}`, label: `E-mail — ${c.email_address}`, status, responseMs: null, detail };
  });
}

async function checkGsystem(): Promise<IntegrationCheck> {
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data } = await supabaseAdmin
    .from("integration_logs")
    .select("status_code, error_message, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data || []) as any[];
  if (!rows.length) {
    return { key: "gsystem", label: "GSystem", status: "unknown", responseMs: null, detail: "Sem chamadas na última hora." };
  }
  const errors = rows.filter((r) => (r.status_code || 0) >= 400 || r.error_message);
  const pct = Math.round((errors.length / rows.length) * 100);
  return {
    key: "gsystem",
    label: "GSystem",
    status: pct >= 50 ? "down" : pct > 0 ? "warn" : "ok",
    responseMs: null,
    detail: `${rows.length} chamadas na última hora, ${errors.length} com falha (${pct}%).`,
  };
}

export async function collectSystemHealth(force = false): Promise<SystemHealth> {
  if (!force && cache.data && Date.now() - cache.at < CACHE_MS) return cache.data;

  const result: SystemHealth = {
    generatedAt: new Date().toISOString(),
    db: {
      ok: false, sizeBytes: 0, sizeGrowth7dBytes: null, connections: 0, activeConnections: 0,
      idleInTransaction: 0, maxConnections: 0, connectionsPct: 0, cacheHitPct: 0, deadlocks: 0,
      rollbacks: 0, commits: 0, tempFiles: 0, tempBytes: 0, startedAt: null, longestQuerySeconds: 0,
    },
    cron: { available: false, rows: [] },
    slowQueries: { available: false, rows: [] },
    tables: { rows: [] },
    integrations: [],
    queues: { botPending: 0, emailChannelsWithError: 0, ticketsOpenOver24h: 0, chatsWaitingOver1h: 0 },
    failures: { last24h: 0, last7d: 0, byService: [] },
    settings: null,
  };

  // Banco
  try {
    const db = await rpc("sys_db_health");
    const maxConn = Number(db.max_connections || 0);
    const conns = Number(db.connections || 0);
    result.db = {
      ok: true,
      sizeBytes: Number(db.db_size_bytes || 0),
      sizeGrowth7dBytes: null,
      connections: conns,
      activeConnections: Number(db.active_connections || 0),
      idleInTransaction: Number(db.idle_in_transaction || 0),
      maxConnections: maxConn,
      connectionsPct: maxConn ? Math.round((conns / maxConn) * 100) : 0,
      cacheHitPct: Number(db.cache_hit_pct || 0),
      deadlocks: Number(db.deadlocks || 0),
      rollbacks: Number(db.rollbacks || 0),
      commits: Number(db.commits || 0),
      tempFiles: Number(db.temp_files || 0),
      tempBytes: Number(db.temp_bytes || 0),
      startedAt: db.started_at || null,
      longestQuerySeconds: Number(db.longest_query_seconds || 0),
    };
  } catch (e: any) {
    result.db.error = e?.message || String(e);
  }

  // Crescimento (comparação com o snapshot mais antigo dos últimos 7 dias)
  try {
    const since = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const { data } = await supabaseAdmin
      .from("system_health_snapshots")
      .select("db_size_bytes, captured_at")
      .gte("captured_at", since)
      .order("captured_at", { ascending: true })
      .limit(1);
    const first = (data || [])[0] as any;
    if (first && result.db.ok) result.db.sizeGrowth7dBytes = result.db.sizeBytes - Number(first.db_size_bytes || 0);
  } catch { /* opcional */ }

  // Rotinas automáticas
  try {
    const cron = await rpc("sys_cron_runs");
    result.cron = { available: !!cron?.available, rows: cron?.rows || [] };
  } catch (e: any) {
    result.cron = { available: false, rows: [], error: e?.message || String(e) };
  }

  // Consultas lentas
  try {
    const sq = await rpc("sys_slow_queries");
    result.slowQueries = { available: !!sq?.available, rows: sq?.rows || [] };
  } catch (e: any) {
    result.slowQueries = { available: false, rows: [], error: e?.message || String(e) };
  }

  // Tabelas
  try {
    result.tables = { rows: (await rpc("sys_table_sizes")) || [] };
  } catch (e: any) {
    result.tables = { rows: [], error: e?.message || String(e) };
  }

  // Integrações
  const checks = await Promise.all([
    checkZapi().catch(() => [] as IntegrationCheck[]),
    checkSeuInstalador().catch((e) => ({ key: "seu-instalador", label: "Seu Instalador", status: "unknown" as Status, responseMs: null, detail: String(e?.message || e) })),
    checkTopGamific().catch((e) => ({ key: "topgamific", label: "Top Gamific", status: "unknown" as Status, responseMs: null, detail: String(e?.message || e) })),
    checkEmailChannels().catch(() => [] as IntegrationCheck[]),
    checkGsystem().catch((e) => ({ key: "gsystem", label: "GSystem", status: "unknown" as Status, responseMs: null, detail: String(e?.message || e) })),
  ]);
  result.integrations = checks.flat() as IntegrationCheck[];

  // Filas
  try {
    const nowIso = new Date().toISOString();
    const day = new Date(Date.now() - 24 * 3600_000).toISOString();
    const hour = new Date(Date.now() - 3600_000).toISOString();

    const [bot, tickets, chats, emails] = await Promise.all([
      supabaseAdmin.from("bot_auto_reply_log").select("id", { count: "exact", head: true })
        .eq("status", "scheduled").lte("scheduled_for", nowIso),
      supabaseAdmin.from("service_tickets").select("id", { count: "exact", head: true })
        .in("status", ["aberto", "em_andamento"]).lt("created_at", day),
      supabaseAdmin.from("zapi_chats").select("id", { count: "exact", head: true })
        .eq("status", "aguardando").lt("last_message_at", hour),
      supabaseAdmin.from("email_channels").select("id", { count: "exact", head: true })
        .eq("is_active", true).neq("last_poll_status", "ok"),
    ]);
    result.queues = {
      botPending: bot.count || 0,
      ticketsOpenOver24h: tickets.count || 0,
      chatsWaitingOver1h: chats.count || 0,
      emailChannelsWithError: emails.count || 0,
    };
  } catch { /* contadores opcionais */ }

  // Falhas de integração
  try {
    const d7 = new Date(Date.now() - 7 * 24 * 3600_000).toISOString();
    const d1 = new Date(Date.now() - 24 * 3600_000).toISOString();
    const { data } = await supabaseAdmin
      .from("integration_logs")
      .select("endpoint, status_code, error_message, created_at")
      .gte("created_at", d7)
      .order("created_at", { ascending: false })
      .limit(1000);
    const rows = ((data || []) as any[]).filter((r) => (r.status_code || 0) >= 400 || r.error_message);
    result.failures.last7d = rows.length;
    result.failures.last24h = rows.filter((r) => r.created_at >= d1).length;
    const map = new Map<string, { service: string; count: number; lastError: string | null; lastAt: string | null }>();
    for (const r of rows) {
      const service = String(r.endpoint || "desconhecido").split("?")[0] as string;
      const cur = map.get(service) || { service, count: 0, lastError: null, lastAt: null };
      cur.count += 1;
      if (!cur.lastAt) { cur.lastAt = r.created_at; cur.lastError = r.error_message || `HTTP ${r.status_code}`; }
      map.set(service, cur);
    }
    result.failures.byService = [...map.values()].sort((a, b) => b.count - a.count).slice(0, 10);
  } catch { /* opcional */ }

  // Configurações
  try {
    const { data } = await supabaseAdmin.from("system_health_settings").select("*").limit(1).maybeSingle();
    result.settings = data || null;
  } catch { /* opcional */ }

  cache.at = Date.now();
  cache.data = result;
  return result;
}

export function overallStatus(h: SystemHealth): { db: Status; cron: Status; integrations: Status; failures: Status } {
  const s = h.settings || {};
  const connWarn = Number(s.connections_pct_warn ?? 80);
  const cacheMin = Number(s.cache_hit_min_pct ?? 95);
  const staleMin = Number(s.cron_stale_minutes ?? 15);
  const errPerHour = Number(s.integration_errors_per_hour ?? 10);

  let db: Status = "unknown";
  if (h.db.ok) {
    db = "ok";
    if (h.db.connectionsPct >= connWarn || h.db.cacheHitPct < cacheMin) db = "warn";
    if (h.db.connectionsPct >= 95) db = "down";
  }

  let cron: Status = h.cron.available ? "ok" : "unknown";
  for (const j of h.cron.rows) {
    const last = j.last_run ? new Date(j.last_run).getTime() : 0;
    const minuteJob = String(j.schedule || "").includes("* * * * *");
    const stale = minuteJob && (!last || Date.now() - last > staleMin * 60_000);
    if (j.last_status && j.last_status !== "succeeded") cron = "down";
    else if ((stale || Number(j.failures_24h || 0) > 0) && cron !== "down") cron = "warn";
  }

  let integrations: Status = "ok";
  for (const i of h.integrations) {
    if (i.status === "down") integrations = "down";
    else if (i.status === "warn" && integrations !== "down") integrations = "warn";
  }
  if (!h.integrations.length) integrations = "unknown";

  const failures: Status = h.failures.last24h >= errPerHour * 24 ? "down" : h.failures.last24h > 0 ? "warn" : "ok";

  return { db, cron, integrations, failures };
}
