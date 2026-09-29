import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const API_BASE = "https://seuinstalador-com-br.lovable.app/api/public/integrations/v1";

type CallOptions = {
  path: string;
  method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE";
  query?: Record<string, string | number | undefined | null>;
  body?: unknown;
  idempotencyKey?: string;
  userName: string;
};

function buildUrl(path: string, query?: CallOptions["query"]) {
  const url = new URL(`${API_BASE}${path}`);
  for (const [k, v] of Object.entries(query || {})) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, String(v));
  }
  return url.toString();
}

function messageForStatus(status: number, apiMessage?: string, retryAfter?: string | null) {
  if (apiMessage && status !== 401 && status !== 429 && status !== 500) return apiMessage;
  switch (status) {
    case 400:
      return "Dados inválidos. Revise as informações e tente novamente.";
    case 401:
      return "Chave de integração ausente ou incorreta. Fale com o administrador.";
    case 404:
      return "Registro não encontrado no Seu Instalador.";
    case 409:
      return "Conflito: já existe agendamento nesse horário ou com esse identificador.";
    case 429:
      return `Muitas solicitações. Aguarde ${retryAfter || "alguns"} segundos e tente novamente.`;
    case 500:
      return "Falha interna no Seu Instalador. Tente novamente em instantes.";
    default:
      return apiMessage || `Falha na comunicação com o Seu Instalador (${status}).`;
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function callApi<T>(opts: CallOptions): Promise<T> {
  const key = process.env["SEU_INSTALADOR_INTEGRATION_API_KEY"];
  if (!key) {
    throw new Error("A integração com o Seu Instalador ainda não foi configurada (chave de acesso ausente).");
  }
  const method = opts.method || "GET";
  // Mutações sempre com Idempotency-Key; a mesma chave é reaproveitada na repetição.
  const idempotencyKey = method !== "GET" ? opts.idempotencyKey || crypto.randomUUID() : undefined;
  const url = buildUrl(opts.path, opts.query);
  const bodyText = opts.body !== undefined ? JSON.stringify(opts.body) : undefined;

  for (let attempt = 0; attempt < 2; attempt++) {
    const headers: Record<string, string> = {
      "X-Integration-Key": key,
      "X-External-User-Name": opts.userName,
      "X-Request-Id": crypto.randomUUID(),
    };
    if (bodyText !== undefined) headers["Content-Type"] = "application/json";
    if (idempotencyKey) headers["Idempotency-Key"] = idempotencyKey;

    let response: Response;
    try {
      response = await fetch(url, { method, headers, body: bodyText, signal: AbortSignal.timeout(25_000) });
    } catch {
      if (attempt === 0) { await sleep(800); continue; }
      throw new Error("Não foi possível falar com o Seu Instalador. Verifique a conexão e tente novamente.");
    }

    const text = await response.text();
    let payload: any = null;
    try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

    if (response.status === 429 && attempt === 0) {
      const ra = Number(response.headers.get("Retry-After"));
      const wait = Number.isFinite(ra) && ra > 0 ? ra : 2;
      if (wait <= 10) { await sleep(wait * 1000); continue; }
    }

    if (!response.ok || payload?.success === false) {
      const apiMessage = payload?.error?.message || payload?.message;
      if (response.status === 404 && /endpoint/i.test(String(apiMessage || ""))) {
        throw new Error("Este recurso ainda não foi liberado pelo Seu Instalador na integração.");
      }
      throw new Error(messageForStatus(response.status, apiMessage, response.headers.get("Retry-After")));
    }
    if (payload === null && text.trim().startsWith("<")) {
      throw new Error("Este recurso ainda não foi liberado pelo Seu Instalador na integração.");
    }
    return (payload ?? {}) as T;
  }
  throw new Error("Falha na comunicação com o Seu Instalador.");
}

async function resolveUserName(context: any): Promise<string> {
  const { data } = await context.supabase
    .from("profiles")
    .select("name")
    .eq("user_id", context.userId)
    .maybeSingle();
  const name = (data as any)?.name;
  if (!name) throw new Error("Seu perfil está sem nome cadastrado. Peça ao administrador para preencher.");
  return name as string;
}

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const consultarTimeline = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ date: z.string().regex(dateRegex) }).parse(input))
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({ path: "/timeline", query: { date: data.date }, userName });
  });

export const listarAtividades = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        scheduledFrom: z.string().regex(dateRegex).optional(),
        scheduledTo: z.string().regex(dateRegex).optional(),
        createdFrom: z.string().regex(dateRegex).optional(),
        createdTo: z.string().regex(dateRegex).optional(),
        clientId: z.string().optional(),
        technicianId: z.string().optional(),
        status: z.string().optional(),
        search: z.string().optional(),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({ path: "/activities", query: data as any, userName });
  });

export const buscarClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().min(3) }).parse(input))
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({ path: "/clients", query: { search: data.search }, userName });
  });

export const tiposDeServicoDoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ clientId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({
      path: `/clients/${encodeURIComponent(data.clientId)}/service-types`,
      userName,
    });
  });

export const listarTecnicos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ search: z.string().optional() }).parse(input ?? {}))
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({ path: "/technicians", query: { search: data.search }, userName });
  });

export const historicoOS = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ orderId: z.string().min(1) }).parse(input))
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({
      path: `/orders/${encodeURIComponent(data.orderId)}/history`,
      userName,
    });
  });

export const historicoCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        clientId: z.string().min(1),
        page: z.number().int().min(1).default(1),
        pageSize: z.number().int().min(1).max(100).default(50),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    return await callApi<any>({
      path: `/clients/${encodeURIComponent(data.clientId)}/history`,
      query: { page: data.page, pageSize: data.pageSize },
      userName,
    });
  });

export const criarAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        idempotencyKey: z.string().uuid(),
        clientId: z.string().min(1),
        technicianId: z.string().min(1),
        serviceTypeId: z.string().min(1),
        scheduledAt: z.string().min(1),
        durationMinutes: z.number().int().min(15).max(24 * 60),
        identifier: z.string().optional(),
        address: z.string().optional(),
        noAddress: z.boolean().default(false),
        description: z.string().optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const userName = await resolveUserName(context);
    const { idempotencyKey, ...body } = data;
    return await callApi<any>({
      path: "/appointments",
      method: "POST",
      body,
      idempotencyKey,
      userName,
    });
  });

// ---------- Ações em OS ----------

const idem = z.string().uuid().optional();
const idStr = z.string().min(1).max(100);

function mutation<S extends z.ZodTypeAny>(
  schema: S,
  build: (d: z.infer<S>) => { path: string; method: "POST" | "PATCH" | "DELETE"; body?: unknown },
  opts: { managerOnly?: boolean } = {},
) {
  return createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input: unknown) => schema.parse(input) as z.infer<S>)
    .handler(async ({ data, context }) => {
      if (opts.managerOnly) await requireManager(context);
      const userName = await resolveUserName(context);
      const { path, method, body } = build(data);
      return await callApi<any>({
        path,
        method,
        body,
        idempotencyKey: (data as any).idempotencyKey,
        userName,
      });
    });
}

async function requireManager(context: any) {
  const { data } = await context.supabase.from("user_roles").select("role").eq("user_id", context.userId);
  const roles = ((data as any[]) || []).map((r) => r.role);
  if (!roles.includes("admin") && !roles.includes("gestor")) {
    throw new Error("Apenas Admin ou Gestor podem realizar esta ação.");
  }
}

function query<S extends z.ZodTypeAny>(schema: S, build: (d: z.infer<S>) => { path: string; query?: any }) {
  return createServerFn({ method: "POST" })
    .middleware([requireSupabaseAuth])
    .inputValidator((input: unknown) => schema.parse(input ?? {}) as z.infer<S>)
    .handler(async ({ data, context }) => {
      const userName = await resolveUserName(context);
      const { path, query: q } = build(data);
      return await callApi<any>({ path, query: q, userName });
    });
}

const enc = encodeURIComponent;

export const obterOS = query(z.object({ orderId: idStr }), (d) => ({ path: `/orders/${enc(d.orderId)}` }));

const orderPatch = z.object({
  idempotencyKey: idem,
  orderId: idStr,
  technicianId: z.string().optional(),
  serviceTypeId: z.string().optional(),
  scheduledAt: z.string().optional(),
  durationMinutes: z.number().int().min(15).max(1440).optional(),
  identifier: z.string().max(100).optional(),
  address: z.string().max(500).optional(),
  noAddress: z.boolean().optional(),
  description: z.string().max(5000).optional(),
});
export const atualizarOS = mutation(
  orderPatch,
  ({ orderId, idempotencyKey, ...body }) => ({ path: `/orders/${enc(orderId)}`, method: "PATCH", body }),
  { managerOnly: true },
);
export const excluirOS = mutation(
  z.object({ idempotencyKey: idem, orderId: idStr }),
  (d) => ({ path: `/orders/${enc(d.orderId)}`, method: "DELETE" }),
  { managerOnly: true },
);
export const reagendarOS = mutation(
  z.object({
    idempotencyKey: idem,
    orderId: idStr,
    scheduledAt: z.string().min(1),
    technicianId: z.string().optional(),
    durationMinutes: z.number().int().min(15).max(1440).optional(),
    reason: z.string().max(1000).optional(),
  }),
  ({ orderId, idempotencyKey, ...body }) => ({ path: `/orders/${enc(orderId)}/reschedule`, method: "POST", body }),
);
export const clonarOS = mutation(
  z.object({ idempotencyKey: idem, orderId: idStr, scheduledAt: z.string().optional(), technicianId: z.string().optional() }),
  ({ orderId, idempotencyKey, ...body }) => ({ path: `/orders/${enc(orderId)}/clone`, method: "POST", body }),
);
export const alterarStatusOS = mutation(
  z.object({ idempotencyKey: idem, orderId: idStr, status: z.string().min(1), reason: z.string().max(1000).optional() }),
  ({ orderId, idempotencyKey, ...body }) => ({ path: `/orders/${enc(orderId)}/status`, method: "POST", body }),
  { managerOnly: true },
);

// Compatibilidade com telas existentes
export const atualizarAgendamento = mutation(
  orderPatch.omit({ orderId: true }).extend({ appointmentId: idStr }),
  ({ appointmentId, idempotencyKey, ...body }) => ({ path: `/orders/${enc(appointmentId)}`, method: "PATCH", body }),
  { managerOnly: true },
);
export const alterarStatusAgendamento = mutation(
  z.object({ idempotencyKey: idem, appointmentId: idStr, status: z.string().min(1), reason: z.string().optional() }),
  ({ appointmentId, idempotencyKey, ...body }) => ({ path: `/orders/${enc(appointmentId)}/status`, method: "POST", body }),
  { managerOnly: true },
);

// ---------- Técnicos terceiros ----------

export const listarTecnicosTerceiros = query(z.object({ search: z.string().optional() }), (d) => ({
  path: "/third-party-technicians",
  query: { search: d.search },
}));
export const criarAgendamentoTerceiro = mutation(
  z.object({
    idempotencyKey: idem,
    clientId: idStr,
    thirdPartyTechnicianId: idStr,
    serviceTypeId: idStr,
    scheduledAt: z.string().min(1),
    durationMinutes: z.number().int().min(15).max(1440),
    identifier: z.string().max(100).optional(),
    address: z.string().max(500).optional(),
    noAddress: z.boolean().optional(),
    description: z.string().max(5000).optional(),
  }),
  ({ idempotencyKey, ...body }) => ({ path: "/third-party-appointments", method: "POST", body }),
);
export const renovarLinkTerceiro = mutation(
  z.object({ idempotencyKey: idem, orderId: idStr }),
  (d) => ({ path: `/orders/${enc(d.orderId)}/third-party-link`, method: "POST", body: {} }),
);
export const revogarLinkTerceiro = mutation(
  z.object({ idempotencyKey: idem, orderId: idStr }),
  (d) => ({ path: `/orders/${enc(d.orderId)}/third-party-link/revoke`, method: "POST", body: {} }),
);

// ---------- Solicitações ----------

const dateOpt = z.string().regex(dateRegex).optional();
export const listarSolicitacoes = query(
  z.object({
    status: z.string().optional(),
    clientId: z.string().optional(),
    serviceTypeId: z.string().optional(),
    desiredFrom: dateOpt,
    desiredTo: dateOpt,
    search: z.string().max(200).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  }),
  (d) => ({ path: "/requests", query: d }),
);
export const obterSolicitacao = query(z.object({ requestId: idStr }), (d) => ({ path: `/requests/${enc(d.requestId)}` }));
export const disponibilidadeSolicitacoes = query(z.object({ date: z.string().regex(dateRegex) }), (d) => ({
  path: "/requests/availability",
  query: { date: d.date },
}));

const requestBody = z.object({
  clientId: idStr,
  serviceTypeId: idStr,
  desiredAt: z.string().min(1),
  durationMinutes: z.number().int().min(15).max(1440),
  address: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  contactName: z.string().min(1).max(200),
  contactEmail: z.string().email().max(255).optional(),
  contactPhone: z.string().min(8).max(30),
  notifyContact: z.boolean().optional(),
  identifier: z.string().max(100).optional(),
});
export const criarSolicitacao = mutation(requestBody.extend({ idempotencyKey: idem }), ({ idempotencyKey, ...body }) => ({
  path: "/requests",
  method: "POST",
  body,
}));
export const atualizarSolicitacao = mutation(
  requestBody.extend({ idempotencyKey: idem, requestId: idStr }),
  ({ idempotencyKey, requestId, ...body }) => ({ path: `/requests/${enc(requestId)}`, method: "PATCH", body }),
);
export const comentarSolicitacao = mutation(
  z.object({ idempotencyKey: idem, requestId: idStr, content: z.string().trim().min(1).max(2000) }),
  (d) => ({ path: `/requests/${enc(d.requestId)}/comments`, method: "POST", body: { content: d.content } }),
);
export const aprovarSolicitacao = mutation(
  z.object({ idempotencyKey: idem, requestId: idStr, technicianId: idStr, scheduledAt: z.string().min(1) }),
  (d) => ({
    path: `/requests/${enc(d.requestId)}/approve`,
    method: "POST",
    body: { technicianId: d.technicianId, scheduledAt: d.scheduledAt },
  }),
);
export const recusarSolicitacao = mutation(
  z.object({ idempotencyKey: idem, requestId: idStr, reason: z.string().trim().min(1).max(1000) }),
  (d) => ({ path: `/requests/${enc(d.requestId)}/reject`, method: "POST", body: { reason: d.reason } }),
);
export const cancelarSolicitacao = mutation(
  z.object({ idempotencyKey: idem, requestId: idStr, reason: z.string().max(1000).optional() }),
  (d) => ({ path: `/requests/${enc(d.requestId)}/cancel`, method: "POST", body: { reason: d.reason } }),
);
export const recriarSolicitacao = mutation(
  z.object({ idempotencyKey: idem, requestId: idStr, desiredAt: z.string().min(1), note: z.string().trim().min(1).max(1000) }),
  (d) => ({
    path: `/requests/${enc(d.requestId)}/recreate`,
    method: "POST",
    body: { desiredAt: d.desiredAt, note: d.note },
  }),
);

// ---------- Direcionamento regional ----------

export const listarDirecionamentos = query(
  z.object({
    status: z.string().optional(),
    search: z.string().max(200).optional(),
    page: z.number().int().min(1).default(1),
    pageSize: z.number().int().min(1).max(100).default(50),
  }),
  (d) => ({ path: "/routing-requests", query: d }),
);
export const obterDirecionamento = query(z.object({ routingId: idStr }), (d) => ({
  path: `/routing-requests/${enc(d.routingId)}`,
}));
export const criarDirecionamento = mutation(
  z.object({
    idempotencyKey: idem,
    clientId: idStr,
    serviceTypeId: idStr,
    identifier: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
    address: z.string().min(1).max(500),
    lat: z.number().min(-90).max(90),
    lng: z.number().min(-180).max(180),
    serviceDate: z.string().regex(dateRegex),
    scheduleType: z.enum(["exato", "janela"]),
    windowStart: z.string().regex(/^\d{2}:\d{2}$/),
    windowEnd: z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: z.number().int().min(15).max(1440),
    priority: z.enum(["normal", "alta", "urgente"]),
    contactName: z.string().max(200).optional(),
    contactPhone: z.string().max(30).optional(),
  }),
  ({ idempotencyKey, ...body }) => ({ path: "/routing-requests", method: "POST", body }),
);
export const analisarDirecionamento = mutation(
  z.object({ idempotencyKey: idem, routingId: idStr }),
  (d) => ({ path: `/routing-requests/${enc(d.routingId)}/analyze`, method: "POST", body: {} }),
);
export const confirmarDirecionamento = mutation(
  z.object({
    idempotencyKey: idem,
    routingId: idStr,
    technicianId: idStr,
    scheduledAt: z.string().min(1),
    justification: z.string().max(1000).optional(),
  }),
  ({ idempotencyKey, routingId, ...body }) => ({
    path: `/routing-requests/${enc(routingId)}/confirm`,
    method: "POST",
    body,
  }),
);
