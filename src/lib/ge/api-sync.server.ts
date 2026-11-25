import { geAdmin as supabaseAdmin } from "@/lib/ge/db.server";
import * as tls from "node:tls";
import { resolveEventDriver, type DriverRecord } from "@/lib/ge/driver-resolution";

// A documentação da YUV pede GET com body JSON, mas dependendo do gateway de
// borda o pedido pode ser rejeitado com "Invalid request body" se o body for
// enviado de forma não convencional. Tentamos várias estratégias e ficamos com
// a primeira que responder 2xx; cache da escolha durante a vida do worker.
export function normalizeYuvBase(baseUrl: string | null | undefined): string {
  const fallback = "https://api.cloud-services.yuv.com.br";
  let base = (baseUrl || fallback).trim().replace(/\/$/, "");
  try {
    const u = new URL(base);
    if (/(^|\.)yuv\.com\.br$/i.test(u.hostname)) return fallback;
    return `${u.protocol}//${u.host}`;
  } catch {
    base = fallback;
  }
  return base;
}

type YuvStrategy = "post" | "get_query" | "get_body_tls";
let cachedYuvStrategy: YuvStrategy | null = null;

function tlsGetWithBody(
  url: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs: number,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const host = u.hostname;
    const port = Number(u.port || 443);
    const path = u.pathname + u.search;
    const payload = Buffer.from(JSON.stringify(body), "utf8");
    const head =
      `GET ${path} HTTP/1.1\r\n` +
      `Host: ${host}\r\n` +
      `Authorization: Bearer ${token}\r\n` +
      `Accept: application/json\r\n` +
      `Content-Type: application/json\r\n` +
      `Content-Length: ${payload.length}\r\n` +
      `Connection: close\r\n` +
      `\r\n`;
    const socket = tls.connect({ host, port, servername: host });
    const chunks: Buffer[] = [];
    let settled = false;
    const finish = (err: Error | null, status?: number, text?: string) => {
      if (settled) return;
      settled = true;
      try { socket.destroy(); } catch { /* noop */ }
      if (err) reject(err);
      else resolve({ status: status ?? 0, text: text ?? "" });
    };
    const timer = setTimeout(() => finish(new Error("YUV request timeout")), timeoutMs);
    socket.on("secureConnect", () => {
      socket.write(head);
      socket.write(payload);
    });
    socket.on("data", (c: Buffer) => chunks.push(c));
    socket.on("error", (e) => { clearTimeout(timer); finish(e); });
    socket.on("end", () => {
      clearTimeout(timer);
      const raw = Buffer.concat(chunks).toString("utf8");
      const sep = raw.indexOf("\r\n\r\n");
      if (sep < 0) return finish(null, 0, raw);
      const headersText = raw.slice(0, sep);
      let bodyText = raw.slice(sep + 4);
      const statusLine = headersText.split("\r\n")[0] ?? "";
      const m = statusLine.match(/^HTTP\/1\.\d\s+(\d{3})/);
      const status = m ? Number(m[1]) : 0;
      if (/transfer-encoding:\s*chunked/i.test(headersText)) {
        let decoded = "";
        let i = 0;
        while (i < bodyText.length) {
          const nl = bodyText.indexOf("\r\n", i);
          if (nl < 0) break;
          const size = parseInt(bodyText.slice(i, nl), 16);
          if (!Number.isFinite(size) || size === 0) break;
          decoded += bodyText.slice(nl + 2, nl + 2 + size);
          i = nl + 2 + size + 2;
        }
        bodyText = decoded;
      }
      finish(null, status, bodyText);
    });
  });
}

async function fetchPost(url: string, token: string, body: Record<string, unknown>, timeoutMs: number) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, text: await res.text() };
}

async function fetchGetQuery(url: string, token: string, body: Record<string, unknown>, timeoutMs: number) {
  const u = new URL(url);
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    u.searchParams.set(k, String(v));
  }
  const res = await fetch(u.toString(), {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  return { status: res.status, text: await res.text() };
}

function isInvalidBodyError(r: { status: number; text: string }) {
  return r.status === 400 && /invalid request body/i.test(r.text);
}

export async function yuvGetWithBody(
  url: string,
  token: string,
  body: Record<string, unknown>,
  timeoutMs = 30000,
): Promise<{ status: number; text: string; strategy: YuvStrategy }> {
  // Ordem testada manualmente contra api.cloud-services.yuv.com.br:
  // - GET com body via TLS cru: 200 OK (formato exigido pela documentação)
  // - GET com query string: 400 "Invalid request body"
  // - POST com mesmo body: 400 reclamando de outros campos obrigatórios
  // Por isso get_body_tls é a estratégia primária; as outras existem só como
  // último recurso caso a borda da YUV mude de comportamento.
  const order: YuvStrategy[] = ["get_body_tls", "post", "get_query"];
  const strategies: YuvStrategy[] = cachedYuvStrategy
    ? [cachedYuvStrategy, ...order.filter((s) => s !== cachedYuvStrategy)]
    : order;

  let last: { status: number; text: string } = { status: 0, text: "" };
  let lastStrat: YuvStrategy = strategies[0];
  for (const strat of strategies) {
    lastStrat = strat;
    try {
      const r =
        strat === "post" ? await fetchPost(url, token, body, timeoutMs)
        : strat === "get_query" ? await fetchGetQuery(url, token, body, timeoutMs)
        : await tlsGetWithBody(url, token, body, timeoutMs);
      last = r;
      if (r.status >= 200 && r.status < 300) {
        cachedYuvStrategy = strat;
        return { ...r, strategy: strat };
      }
      // Não vale a pena tentar outra estratégia para esses casos:
      if (r.status === 401 || r.status === 403) return { ...r, strategy: strat };
      if (r.status === 404 || (r.status === 500 && /not found|encontrar o registro/i.test(r.text))) {
        return { ...r, strategy: strat };
      }
      // Só seguimos tentando quando a borda da YUV reclama do body em si.
      if (!isInvalidBodyError(r)) return { ...r, strategy: strat };
    } catch (e) {
      last = { status: 0, text: e instanceof Error ? e.message : String(e) };
    }
  }
  return { ...last, strategy: lastStrat };
}

function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function extractCompanyName(raw: Record<string, unknown>, apiType: string): string | null {
  if (apiType === "movias") {
    const company = raw.company as { name?: string } | undefined;
    if (company?.name) return String(company.name);
  }
  for (const k of ["company_name", "client_name", "customer_name", "account_name", "tenant_name", "fleet_name"]) {
    const v = raw[k];
    if (typeof v === "string" && v.trim()) return v;
  }
  const company = raw.company as { name?: string } | undefined;
  if (company?.name) return String(company.name);
  return null;
}

export function normalizeMoviasBase(baseUrl: string): string {
  const trimmed = baseUrl.replace(/\/$/, "");
  try {
    const u = new URL(trimmed);
    if (/movias\.com\.br$/i.test(u.hostname)) {
      return "https://www.movias.com.br:8443";
    }
  } catch {
    // fall through
  }
  return trimmed;
}

function parseMoviasDate(s: string): string {
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/);
  if (!m) return new Date().toISOString();
  // A API envia o horário "de parede" sem offset; tratamos como UTC para
  // que a exibição no navegador (BRT) mostre o horário correto.
  return `${m[3]}-${m[2]}-${m[1]}T${m[4]}:${m[5]}:${m[6]}Z`;
}





export async function moviasLogin(
  baseUrl: string,
  username: string | null,
  password: string | null,
): Promise<string> {
  if (!username || !password) throw new Error("Usuário e senha são obrigatórios para Movias");
  const base = normalizeMoviasBase(baseUrl);
  const res = await fetch(`${base}/ws/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`Login Movias falhou (HTTP ${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { id_token?: string };
  if (!data.id_token) throw new Error("Login Movias não retornou id_token");
  return data.id_token;
}

function extractExternalAccountId(raw: Record<string, unknown>, apiType: string): string | null {
  if (apiType === "movias") {
    const company = raw.company as { uuid?: string; name?: string } | undefined;
    if (company?.uuid) return String(company.uuid);
    if (company?.name) return String(company.name);
  }
  for (const k of ["account_id", "company_id", "customer_id", "client_id", "fleet_id", "tenant_id"]) {
    const v = raw[k];
    if (v !== undefined && v !== null && v !== "") return String(v);
  }
  return null;
}

type Cfg = {
  id: string;
  api_type: string;
  base_url: string;
  username: string | null;
  password_encrypted: string | null;
  bearer_token_encrypted: string | null;
  api_key_encrypted: string | null;
  events_endpoint: string | null;
  client_id: string | null;
  last_sync_at: string | null;
  sync_device_cursor?: number | null;
};

export type SyncResult = Awaited<ReturnType<typeof runSyncForConfig>>;

export function acceptedSyncResult(cfg: Cfg, message = "Sincronização iniciada em segundo plano") {
  return {
    configId: cfg.id,
    apiType: cfg.api_type,
    inserted: 0,
    updated: 0,
    discardedNoClient: 0,
    discardedNoClientByType: 0,
    discardedByType: 0,
    storedUnmatched: 0,
    expiredUnmatched: 0,
    routedToStaging: 0,
    devicesFound: 0,
    alarmsFetched: 0,
    errors: [message],
    errorMessage: null,
    warning: message,
    totalFetched: 0,
    accepted: true,
  };
}

export function startSyncInBackground(cfg: Cfg) {
  const task = runSyncForConfig(cfg).catch((e) => {
    console.error("Falha na sincronização em segundo plano", e);
  });
  const runtime = globalThis as typeof globalThis & {
    EdgeRuntime?: { waitUntil?: (promise: Promise<unknown>) => Promise<unknown> | void };
    __lovableWaitUntil?: (promise: Promise<unknown>) => void;
  };
  if (typeof runtime.EdgeRuntime?.waitUntil === "function") {
    runtime.EdgeRuntime.waitUntil(task);
  } else if (typeof runtime.__lovableWaitUntil === "function") {
    runtime.__lovableWaitUntil(task);
  }
  return task;
}

export async function runSyncForConfig(cfg: Cfg) {
  // Janela mínima por fonte. Na YUV a varredura é por dispositivo com cursor;
  // com centenas de câmeras, um ciclo completo demora mais que 30 minutos.
  // Por isso a janela mínima é 24h e a deduplicação por external_event_id evita duplicatas.
  const MIN_WINDOW_MS = cfg.api_type === "yuv" ? 24 * 60 * 60 * 1000 : 30 * 60 * 1000;
  const defaultSince = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const rawSince = cfg.last_sync_at ? new Date(cfg.last_sync_at) : defaultSince;
  const minSince = new Date(Date.now() - MIN_WINDOW_MS);
  const since = rawSince < minSince ? rawSince : minSince;

  let externalEvents: Array<Record<string, unknown>> = [];
  let errorMessage: string | null = null;
  // Falha "dura" (credencial ou listagem básica) — só esses casos derrubam a conexão.
  let hardFailure = false;
  const errors: string[] = [];
  let devicesFound = 0;
  let alarmsFetched = 0;

  try {
    if (cfg.api_type === "movias") {
      const token = await moviasLogin(cfg.base_url, cfg.username, cfg.password_encrypted);
      const url = `${normalizeMoviasBase(cfg.base_url)}/ws/v1/tracking/receiver`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(30000),
      });
      if (!res.ok) {
        hardFailure = true;
        throw new Error(`Eventos Movias: HTTP ${res.status}`);
      }
      const json = await res.json();
      externalEvents = Array.isArray(json) ? json : [];
    } else if (cfg.api_type === "yuv") {
      const token = cfg.bearer_token_encrypted ?? cfg.api_key_encrypted;
      if (!token) {
        hardFailure = true;
        throw new Error("Bearer token ou API key necessários");
      }
      const base = normalizeYuvBase(cfg.base_url);
      const fmt = (d: Date) => {
        const p = (n: number) => String(n).padStart(2, "0");
        return `${d.getUTCFullYear()}-${p(d.getUTCMonth() + 1)}-${p(d.getUTCDate())} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}:${p(d.getUTCSeconds())}`;
      };
      const startDate = fmt(since);
      const endDate = fmt(new Date());

      // 1) Lista paginada de equipamentos (GET com body JSON — exigência da API YUV)
      type YuvDevice = {
        deviceImei?: string;
        customerId?: number | string | null;
        customerName?: string | null;
        assetPrefix?: string | null;
        assetIdentifier?: string | null;
      };

      // Listar todas as páginas /device sequencialmente custa ~30s na conta atual,
      // o que consome todo o orçamento do worker e impede o processamento de alarmes.
      // Solução: paralelizar páginas em lotes e cachear o resultado por até 30 min na própria config.
      const DEVICE_CACHE_TTL_MS = 30 * 60 * 1000;
      const DEVICE_PAGE_CONCURRENCY = 6;

      const listYuvDevices = async (): Promise<YuvDevice[]> => {
        const firstResp = await yuvGetWithBody(`${base}/device`, token, { page: 1 });
        if (firstResp.status < 200 || firstResp.status >= 300) {
          throw new Error(`YUV /device HTTP ${firstResp.status} (via ${firstResp.strategy}): ${firstResp.text.slice(0, 200)}`);
        }
        const firstJson = JSON.parse(firstResp.text) as { data?: YuvDevice[]; lastPage?: number };
        const collected: YuvDevice[] = [...(firstJson.data ?? [])];
        const lastPage = Math.min(firstJson.lastPage ?? 1, 200);
        if (lastPage <= 1) return collected;

        const pagesById = new Map<number, YuvDevice[]>();
        for (let start = 2; start <= lastPage; start += DEVICE_PAGE_CONCURRENCY) {
          const batch: number[] = [];
          for (let p = start; p < start + DEVICE_PAGE_CONCURRENCY && p <= lastPage; p++) batch.push(p);
          const results = await Promise.all(
            batch.map(async (p) => {
              const r = await yuvGetWithBody(`${base}/device`, token, { page: p });
              if (r.status === 404) return { page: p, devices: [] as YuvDevice[] };
              if (r.status < 200 || r.status >= 300) {
                throw new Error(`YUV /device page ${p} HTTP ${r.status}: ${r.text.slice(0, 160)}`);
              }
              const j = JSON.parse(r.text) as { data?: YuvDevice[] };
              return { page: p, devices: j.data ?? [] };
            }),
          );
          for (const { page, devices: ds } of results) pagesById.set(page, ds);
        }
        for (let p = 2; p <= lastPage; p++) {
          for (const d of pagesById.get(p) ?? []) collected.push(d);
        }
        return collected;
      };

      const cfgWithCache = cfg as Cfg & {
        sync_devices_cache?: unknown;
        sync_devices_cache_at?: string | null;
      };
      const cachedAt = cfgWithCache.sync_devices_cache_at
        ? new Date(cfgWithCache.sync_devices_cache_at).getTime()
        : 0;
      const cachedDevices = Array.isArray(cfgWithCache.sync_devices_cache)
        ? (cfgWithCache.sync_devices_cache as YuvDevice[])
        : [];
      const cacheFresh = cachedAt > 0 && Date.now() - cachedAt < DEVICE_CACHE_TTL_MS && cachedDevices.length > 0;

      let devices: YuvDevice[];
      if (cacheFresh) {
        devices = cachedDevices;
        errors.push(`YUV /device: cache hit (${devices.length} dispositivos, idade ${Math.round((Date.now()-cachedAt)/1000)}s)`);
      } else {
        try {
          const t0 = Date.now();
          devices = await listYuvDevices();
          await supabaseAdmin
            .from("ge_api_configurations")
            .update({
              sync_devices_cache: devices,
              sync_devices_cache_at: new Date().toISOString(),
            })
            .eq("id", cfg.id);
          errors.push(`YUV /device: cache refresh OK (${devices.length} dispositivos em ${Date.now()-t0}ms)`);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (cachedDevices.length > 0) {
            errors.push(`YUV /device: usando cache antigo após falha — ${msg}`);
            devices = cachedDevices;
          } else {
            hardFailure = true;
            throw e;
          }
        }
      }
      devicesFound = devices.length;

      // 2) Para cada equipamento, obter alarmes no intervalo (tolerante a falhas)
      type YuvAlarm = {
        deviceImei?: string;
        assetPrefix?: string;
        assetIdentifier?: string;
        driverId?: number | string;
        driverName?: string;
        customerName?: string;
        alarmName?: string;
        alarmLatitude?: string;
        alarmLongitude?: string;
        alarmTime?: string;
        alarmFiles?: string[];
      };
      // Orçamento de tempo abaixo do limite do gateway (~30s), com lote maior
      // para que clientes com muitos dispositivos sejam varridos em poucos ciclos.
      const TIME_BUDGET_MS = 24_000;
      const MAX_DEVICES_PER_RUN = 96;
      const CONCURRENCY = 8;
      const startedAt = Date.now();
      const timeUp = () => Date.now() - startedAt > TIME_BUDGET_MS;

      let rateLimited = false;
      // Cursor: começa onde a última sync parou para distribuir o trabalho.
      const cursorStart = cfg.sync_device_cursor ?? 0;
      const startIdx = devices.length > 0 ? cursorStart % devices.length : 0;
      const maxToProcess = Math.min(devices.length, MAX_DEVICES_PER_RUN);
      const slice: { idx: number; dev: YuvDevice }[] = [];
      for (let i = 0; i < maxToProcess; i++) {
        const idx = (startIdx + i) % devices.length;
        slice.push({ idx, dev: devices[idx] });
      }
      let processed = 0;
      let lastProcessedIdx = startIdx;

      const processOne = async (dev: YuvDevice) => {
        const imei = dev.deviceImei;
        if (!imei) return;
        for (let page = 1; page <= 10; page++) {
          if (rateLimited || timeUp()) return;
          let r: { status: number; text: string; strategy: YuvStrategy } = {
            status: 0,
            text: "",
            strategy: "query" as YuvStrategy,
          };
          try {
            r = await yuvGetWithBody(`${base}/alarms`, token, {
              deviceImei: imei,
              startDate,
              endDate,
              page,
            }, 8000);
          } catch (e) {
            errors.push(`YUV /alarms imei ${imei}: ${e instanceof Error ? e.message : String(e)}`);
            return;
          }
          if (r.status === 429) {
            errors.push(`YUV /alarms imei ${imei}: rate limit (429) — próximo ciclo continua`);
            rateLimited = true;
            return;
          }
          if (r.status === 404 || (r.status === 500 && /not found|encontrar o registro/i.test(r.text))) return;
          if (r.status < 200 || r.status >= 300) {
            errors.push(`YUV /alarms imei ${imei} HTTP ${r.status}: ${r.text.slice(0, 120)}`);
            return;
          }
          let json: { data?: YuvAlarm[]; lastPage?: number };
          try {
            json = JSON.parse(r.text) as { data?: YuvAlarm[]; lastPage?: number };
          } catch {
            errors.push(`YUV /alarms imei ${imei}: resposta não-JSON`);
            return;
          }
          for (const a of json.data ?? []) {
            alarmsFetched++;
            const lat = a.alarmLatitude != null ? Number(a.alarmLatitude) : null;
            const lng = a.alarmLongitude != null ? Number(a.alarmLongitude) : null;
            const customerName = a.customerName || dev.customerName || null;
            const customerId = dev.customerId != null ? String(dev.customerId) : null;
            const alarmTimeIso = a.alarmTime
              ? a.alarmTime.replace(" ", "T") + "Z"
              : new Date().toISOString();
            externalEvents.push({
              id: `${imei}-${a.alarmTime ?? ""}-${a.alarmName ?? ""}`,
              event_type: a.alarmName ?? "unknown",
              timestamp: alarmTimeIso,
              imei,
              driver_id: a.driverId != null ? String(a.driverId) : null,
              driver_name: a.driverName ?? null,
              license_plate: a.assetIdentifier ?? a.assetPrefix ?? null,
              latitude: Number.isFinite(lat) ? lat as number : null,
              longitude: Number.isFinite(lng) ? lng as number : null,
              customer_name: customerName,
              customer_id: customerId,
              alarm_files: a.alarmFiles ?? [],
            });
          }
          if (!json.lastPage || page >= json.lastPage) return;
        }
      };

      // Executa em pool de concorrência fixa.
      let cursor = 0;
      const worker = async () => {
        while (true) {
          if (rateLimited || timeUp()) return;
          const my = cursor++;
          if (my >= slice.length) return;
          const item = slice[my];
          await processOne(item.dev);
          processed++;
          if (item.idx > lastProcessedIdx || my === slice.length - 1) {
            lastProcessedIdx = item.idx;
          }
        }
      };
      await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()));

      // Avança o cursor para o próximo dispositivo após o último processado.
      if (devices.length > 0) {
        const nextCursor = (lastProcessedIdx + 1) % devices.length;
        await supabaseAdmin
          .from("ge_api_configurations")
          .update({ sync_device_cursor: nextCursor })
          .eq("id", cfg.id);
      }
      // Mensagem de progresso (sync é sempre incremental por lote — o cron
      // de 1 min cobre toda a frota automaticamente em poucos ciclos).
      errors.push(`Lote: ${processed}/${devices.length} dispositivos processados — a sincronização automática continua em segundo plano a cada minuto`);

    }
  } catch (e) {
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  const mappingCache = new Map<string, string>();
  const clientNameMap = new Map<string, string>();
  // Cache: clientId -> Map<eventType, is_enabled>
  const typeSettingsCache = new Map<string, Map<string, boolean>>();
  // Cache global de tipos órfãos (sem cliente): eventType -> is_enabled
  const unmatchedTypeCache = new Map<string, boolean>();
  if (!errorMessage && externalEvents.length > 0) {
    const { data: mappings } = await supabaseAdmin
      .from("ge_client_external_accounts")
      .select("external_account_id, client_id")
      .eq("api_type", cfg.api_type as "movias" | "yuv");
    for (const m of mappings ?? []) {
      mappingCache.set(m.external_account_id, m.client_id);
    }
    const { data: clientsRows } = await supabaseAdmin
      .from("ge_clients")
      .select("id, name")
      .eq("is_active", true);
    for (const c of clientsRows ?? []) {
      clientNameMap.set(normalizeName(c.name), c.id);
    }
    const { data: typeSettings } = await supabaseAdmin
      .from("ge_client_event_type_settings")
      .select("client_id, event_type, is_enabled")
      .eq("api_source", cfg.api_type as "movias" | "yuv");
    for (const s of typeSettings ?? []) {
      if (!typeSettingsCache.has(s.client_id)) typeSettingsCache.set(s.client_id, new Map());
      typeSettingsCache.get(s.client_id)!.set(s.event_type, s.is_enabled);
    }
    const { data: unmatchedSettings } = await supabaseAdmin
      .from("ge_unmatched_event_type_settings")
      .select("event_type, is_enabled")
      .eq("api_source", cfg.api_type as "movias" | "yuv");
    for (const s of unmatchedSettings ?? []) {
      unmatchedTypeCache.set(s.event_type, s.is_enabled);
    }
  }

  // ----- Regras de Categorização de Risco -----
  type RiskLevel = "none" | "low" | "medium" | "high" | "critical";
  type RiskRule = {
    event_type: string;
    category: string | null;
    rule_type: string | null;
    min_percent: number | null;
    max_percent: number | null;
    min_duration_seconds: number | null;
    min_count: number | null;
    max_count: number | null;
    risk_level: RiskLevel | null;
    priority: number;
  };
  const RISK_ORDER: Record<RiskLevel, number> = { none: 0, low: 1, medium: 2, high: 3, critical: 4 };
  const riskRulesByClient = new Map<string, RiskRule[]>();
  // Sempre carregar as regras ativas: o roteamento de cliente pode acontecer
  // por mapeamento externo OU por nome, então não dependemos do mappingCache.
  if (!errorMessage && externalEvents.length > 0) {
    const { data: rules } = await supabaseAdmin
      .from("ge_risk_configurations")
      .select("client_id, event_type, category, rule_type, min_percent, max_percent, min_duration_seconds, min_count, max_count, risk_level, priority")
      .eq("is_active", true);
    for (const r of rules ?? []) {
      if (!r.risk_level) continue;
      const arr = riskRulesByClient.get(r.client_id) ?? [];
      arr.push(r as RiskRule);
      riskRulesByClient.set(r.client_id, arr);
    }
  }

  // Cadastro de motoristas (Cliente → Motorista → Veículo/ativo) para correlacionar
  // o evento com o cadastro real do cliente. Sem correspondência, fica não vinculado.
  const driversByClient = new Map<string, DriverRecord[]>();
  if (!errorMessage && externalEvents.length > 0) {
    const { data: driverRows } = await supabaseAdmin
      .from("ge_drivers")
      .select("id, client_id, full_name, cpf, license_plate, is_active")
      .eq("is_active", true);
    for (const d of driverRows ?? []) {
      const arr = driversByClient.get(d.client_id) ?? [];
      arr.push(d as DriverRecord);
      driversByClient.set(d.client_id, arr);
    }
  }

  const numFrom = (v: unknown): number | null => {
    if (typeof v === "number" && Number.isFinite(v)) return v;
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) return Number(v);
    return null;
  };
  const extractSpeed = (raw: Record<string, unknown>): number | null => {
    for (const k of ["speed", "velocidade", "velocity", "max_speed"]) {
      const v = numFrom(raw[k]);
      if (v != null) return v;
    }
    return null;
  };
  const extractLimit = (raw: Record<string, unknown>): number | null => {
    for (const k of ["speed_limit", "limit", "limite"]) {
      const v = numFrom(raw[k]);
      if (v != null) return v;
    }
    const name = raw.activeGeofenceName ?? raw.fence_name ?? raw.geofenceName;
    if (typeof name === "string") {
      const m = name.match(/(\d+)\s*km/i);
      if (m) return Number(m[1]);
    }
    return null;
  };
  const extractDuration = (raw: Record<string, unknown>): number | null => {
    for (const k of ["duration_seconds", "duration", "duracao"]) {
      const v = numFrom(raw[k]);
      if (v != null) return v;
    }
    return null;
  };
  const computeRiskLevel = async (
    clientId: string,
    eventType: string,
    eventTime: string,
    licensePlate: string | null,
    raw: Record<string, unknown>,
  ): Promise<RiskLevel> => {
    const rules = riskRulesByClient.get(clientId);
    if (!rules || rules.length === 0) return "low";
    // Aliases entre nomes técnicos e nomes exibidos pelas APIs.
    const aliasKey = (name: string): string => {
      const n = normalizeName(name);
      if (n === "speeding" || n === "excesso de velocidade" || n === "over speed" || n === "overspeed") {
        return "speeding";
      }
      if (n === "yawning") return "bocejo";
      if (n === "eyes closed" || n === "closed eyes") return "olhos fechados";
      if (n === "phone" || n === "phone call" || n === "using phone") return "uso de celular";
      if (n === "smoking") return "fumando";
      if (n === "fatigue") return "fadiga";
      if (n === "distraction") return "distracao";
      return n;
    };
    const target = aliasKey(eventType);
    const matched = rules.filter((r) => aliasKey(r.event_type) === target);
    if (matched.length === 0) return "low";
    const speed = extractSpeed(raw);
    const limit = extractLimit(raw);
    const pct = speed != null && limit != null && limit > 0 ? ((speed - limit) / limit) * 100 : null;
    const duration = extractDuration(raw);
    let count: number | null = null;
    if (matched.some((r) => r.category === "fatigue" || r.rule_type === "count") && licensePlate) {
      const since = new Date(new Date(eventTime).getTime() - 24 * 60 * 60 * 1000).toISOString();
      const { count: c } = await supabaseAdmin
        .from("ge_events")
        .select("id", { count: "exact", head: true })
        .eq("client_id", clientId)
        .eq("event_type", eventType)
        .eq("license_plate", licensePlate)
        .gte("event_time", since)
        .lte("event_time", eventTime);
      count = (c ?? 0) + 1;
    }
    const candidates: { level: RiskLevel; priority: number }[] = [];
    for (const r of matched) {
      const isCount = r.category === "fatigue" || r.rule_type === "count";
      let ok = false;
      if (isCount) {
        if (count == null) continue;
        const lo = r.min_count ?? 0;
        const hi = r.max_count ?? Number.POSITIVE_INFINITY;
        ok = count >= lo && count <= hi;
      } else {
        if (pct == null) continue;
        const lo = r.min_percent ?? 0;
        const hi = r.max_percent ?? Number.POSITIVE_INFINITY;
        const minDur = r.min_duration_seconds ?? 0;
        // Duração desconhecida (a API não envia): não bloqueia a faixa de %.
        const durOk = duration == null || duration >= minDur;
        ok = pct >= lo && pct <= hi && durOk;
      }
      if (ok && r.risk_level) candidates.push({ level: r.risk_level, priority: r.priority ?? 0 });
    }
    if (candidates.length === 0) {
      // Fadiga acima da maior faixa cadastrada: mantém o nível da última faixa.
      if (count != null) {
        const countRules = matched.filter((r) => r.category === "fatigue" || r.rule_type === "count");
        let top: RiskRule | null = null;
        for (const r of countRules) {
          const hi = r.max_count ?? 0;
          if (count > hi && (top == null || hi >= (top.max_count ?? 0))) top = r;
        }
        if (top?.risk_level) return top.risk_level;
      }
      return "low";
    }
    candidates.sort((a, b) => b.priority - a.priority || RISK_ORDER[b.level] - RISK_ORDER[a.level]);
    return candidates[0].level;
  };

  // Expira eventos órfãos com mais de 24h
  let expiredUnmatched = 0;
  {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data: del } = await supabaseAdmin
      .from("ge_unmatched_events")
      .delete()
      .lt("created_at", cutoff)
      .select("id");
    expiredUnmatched = del?.length ?? 0;
  }

  let inserted = 0;
  let updated = 0;
  let discardedNoClientByType = 0;
  let storedUnmatched = 0;
  let discardedByType = 0;

  // Aggregate catalog upserts: client_id -> eventType -> count seen this run
  const catalogSeen = new Map<string, Map<string, number>>();
  // Catálogo de tipos órfãos detectados este run: eventType -> count
  const unmatchedCatalogSeen = new Map<string, number>();

  if (!errorMessage && externalEvents.length > 0) {
    for (const raw of externalEvents) {
      let externalId: string;
      let eventType: string;
      let eventTime: string;
      let imei: string | null = null;
      let driverId: string | null = null;
      let driverName: string | null = null;
      let licensePlate: string | null = null;
      let latitude: number | null = null;
      let longitude: number | null = null;

      if (cfg.api_type === "movias") {
        const dh = raw.dhTracking ? String(raw.dhTracking) : "";
        const evId = raw.eventId !== undefined && raw.eventId !== null ? String(raw.eventId) : "tr";
        externalId = `${raw.idVeiculo ?? "?"}-${dh}-${evId}`;
        eventType = raw.eventName ? String(raw.eventName) : `event_${evId}`;
        eventTime = dh ? parseMoviasDate(dh) : new Date().toISOString();
        const device = raw.device as { serial?: string | number } | undefined;
        imei = device?.serial ? String(device.serial) : null;
        driverId = raw.serialDriver ? String(raw.serialDriver) : null;
        driverName = raw.driverName ? String(raw.driverName) : null;
        licensePlate = raw.licensePlate ? String(raw.licensePlate) : null;
        latitude = typeof raw.latitude === "number" ? raw.latitude : null;
        longitude = typeof raw.longitude === "number" ? raw.longitude : null;
      } else {
        externalId = String(raw.id ?? raw.event_id ?? raw.external_id ?? "");
        if (!externalId) continue;
        eventType = String(raw.type ?? raw.event_type ?? "unknown");
        eventTime = String(raw.timestamp ?? raw.event_time ?? raw.created_at ?? new Date().toISOString());
        imei = raw.imei ? String(raw.imei) : null;
        driverId = raw.driver_id ? String(raw.driver_id) : null;
        driverName = raw.driver_name ? String(raw.driver_name) : null;
        licensePlate = raw.license_plate ? String(raw.license_plate) : null;
        latitude = typeof raw.latitude === "number" ? raw.latitude : null;
        longitude = typeof raw.longitude === "number" ? raw.longitude : null;
      }

      // Routing: 1) mapeamento por ID externo; 2) match por nome do cliente; 3) descarta.
      // Obs: cfg.client_id NÃO é usado como atalho — todo evento precisa de match real,
      // senão eventos de outras empresas vazariam no cliente vinculado à configuração.
      const externalAccount = extractExternalAccountId(raw, cfg.api_type);
      const companyName = extractCompanyName(raw, cfg.api_type);
      let targetClientId: string | null = null;
      if (externalAccount && mappingCache.has(externalAccount)) {
        targetClientId = mappingCache.get(externalAccount)!;
      } else if (companyName) {
        const matched = clientNameMap.get(normalizeName(companyName));
        if (matched) targetClientId = matched;
      }
      if (!targetClientId) {
        // Catálogo de tipos órfãos
        unmatchedCatalogSeen.set(eventType, (unmatchedCatalogSeen.get(eventType) ?? 0) + 1);
        const unmatchedEnabled = unmatchedTypeCache.get(eventType);
        if (unmatchedEnabled !== true) {
          discardedNoClientByType++;
          continue;
        }
        // Armazena por 24h (upsert idempotente por api_source + external_event_id)
        const { error: upErr } = await supabaseAdmin
          .from("ge_unmatched_events")
          .upsert(
            {
              api_source: cfg.api_type as "movias" | "yuv",
              external_event_id: externalId,
              event_type: eventType,
              event_time: eventTime,
              company_name: companyName,
              external_account_id: externalAccount,
              device_imei: imei,
              driver_id: driverId,
              driver_name: driverName,
              license_plate: licensePlate,
              latitude,
              longitude,
              event_data: JSON.parse(JSON.stringify(raw)),
            },
            { onConflict: "api_source,external_event_id" },
          );
        if (upErr) errors.push(upErr.message);
        else storedUnmatched++;
        continue;
      }

      // Track catalog occurrence for this (client, type)
      if (!catalogSeen.has(targetClientId)) catalogSeen.set(targetClientId, new Map());
      const m = catalogSeen.get(targetClientId)!;
      m.set(eventType, (m.get(eventType) ?? 0) + 1);

      // Decide based on type setting
      const clientSettings = typeSettingsCache.get(targetClientId);
      const enabled = clientSettings?.get(eventType);
      if (enabled !== true) {
        discardedByType++;
        continue;
      }

      const row = {
        client_id: targetClientId,
        api_source: cfg.api_type as "movias" | "yuv",
        external_event_id: externalId,
        event_type: eventType,
        event_time: eventTime,
        device_imei: imei,
        driver_id: driverId,
        driver_name: driverName,
        license_plate: licensePlate,
        latitude,
        longitude,
        event_data: JSON.parse(JSON.stringify(raw)),
      };
      const matchedDriver = resolveEventDriver(
        {
          client_id: targetClientId,
          driver_id: driverId,
          driver_name: driverName,
          license_plate: licensePlate,
        },
        driversByClient.get(targetClientId),
      );
      const rowWithDriver = { ...row, driver_ref_id: matchedDriver?.id ?? null };

      const { data: existing } = await supabaseAdmin
        .from("ge_events")
        .select("id, driver_ref_id, driver_name")
        .eq("api_source", cfg.api_type as "movias" | "yuv")
        .eq("external_event_id", externalId)
        .maybeSingle();
      if (existing) {
        const risk = await computeRiskLevel(targetClientId, eventType, eventTime, licensePlate, row.event_data as Record<string, unknown>);
        // Preserva vínculo manual de motorista feito na tratativa quando a API não traz match.
        const keepRef = existing.driver_ref_id && !matchedDriver;
        const updatePayload = keepRef
          ? { ...row, driver_name: existing.driver_name ?? driverName, risk_level: risk }
          : { ...rowWithDriver, risk_level: risk };
        const { error } = await supabaseAdmin.from("ge_events").update(updatePayload).eq("id", existing.id);
        if (error) errors.push(error.message);
        else updated++;
      } else {
        const risk = await computeRiskLevel(targetClientId, eventType, eventTime, licensePlate, row.event_data as Record<string, unknown>);
        const { error } = await supabaseAdmin.from("ge_events").insert({ ...rowWithDriver, risk_level: risk });
        if (error) errors.push(error.message);
        else inserted++;
      }
    }
  }

  // Persist catalog occurrences for this run
  if (catalogSeen.size > 0) {
    const nowIso = new Date().toISOString();
    for (const [clientId, types] of catalogSeen) {
      for (const [evType, count] of types) {
        const { data: existing } = await supabaseAdmin
          .from("ge_client_event_type_settings")
          .select("occurrences")
          .eq("client_id", clientId)
          .eq("api_source", cfg.api_type as "movias" | "yuv")
          .eq("event_type", evType)
          .maybeSingle();
        if (existing) {
          await supabaseAdmin
            .from("ge_client_event_type_settings")
            .update({ last_seen_at: nowIso, occurrences: (existing.occurrences ?? 0) + count })
            .eq("client_id", clientId)
            .eq("api_source", cfg.api_type as "movias" | "yuv")
            .eq("event_type", evType);
        } else {
          await supabaseAdmin.from("ge_client_event_type_settings").insert({
            client_id: clientId,
            api_source: cfg.api_type as "movias" | "yuv",
            event_type: evType,
            is_enabled: false,
            first_seen_at: nowIso,
            last_seen_at: nowIso,
            occurrences: count,
          });
        }
      }
    }
  }

  // Persist catálogo de tipos órfãos (sem cliente)
  if (unmatchedCatalogSeen.size > 0) {
    const nowIso = new Date().toISOString();
    for (const [evType, count] of unmatchedCatalogSeen) {
      const { data: existing } = await supabaseAdmin
        .from("ge_unmatched_event_type_settings")
        .select("occurrences")
        .eq("api_source", cfg.api_type as "movias" | "yuv")
        .eq("event_type", evType)
        .maybeSingle();
      if (existing) {
        await supabaseAdmin
          .from("ge_unmatched_event_type_settings")
          .update({ last_seen_at: nowIso, occurrences: (existing.occurrences ?? 0) + count })
          .eq("api_source", cfg.api_type as "movias" | "yuv")
          .eq("event_type", evType);
      } else {
        await supabaseAdmin.from("ge_unmatched_event_type_settings").insert({
          api_source: cfg.api_type as "movias" | "yuv",
          event_type: evType,
          is_enabled: false,
          first_seen_at: nowIso,
          last_seen_at: nowIso,
          occurrences: count,
        });
      }
    }
  }


  // Só marca a integração como "error" para falhas duras (credencial/listagem).
  // Falhas pontuais em /alarms ficam como avisos em `errors`, mas a conexão segue ativa.
  const finalStatus: "active" | "error" = hardFailure ? "error" : "active";
  await supabaseAdmin
    .from("ge_api_configurations")
    .update({
      last_sync_at: new Date().toISOString(),
      connection_status: finalStatus,
      error_message: hardFailure ? errorMessage : null,
    })
    .eq("id", cfg.id);

  const discardedNoClient = discardedNoClientByType;
  return {
    configId: cfg.id,
    apiType: cfg.api_type,
    inserted,
    updated,
    discardedNoClient,
    discardedNoClientByType,
    discardedByType,
    storedUnmatched,
    expiredUnmatched,
    routedToStaging: discardedNoClient + discardedByType,
    devicesFound,
    alarmsFetched,
    errors,
    errorMessage: hardFailure ? errorMessage : null,
    warning: !hardFailure && errors.length > 0 ? errors[0] : null,
    totalFetched: externalEvents.length,
  };
}
