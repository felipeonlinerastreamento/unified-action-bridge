import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const API_BASE = "https://seuinstalador-com-br.lovable.app/api/public/integrations/v1";

type CallOptions = {
  path: string;
  method?: "GET" | "POST";
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
  if (apiMessage) {
    // Mensagens da API já vêm em português na maioria dos casos.
    if (status === 409) return apiMessage;
    if (status === 400) return apiMessage;
  }
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

async function callApi<T>(opts: CallOptions): Promise<T> {
  const key = process.env["SEU_INSTALADOR_INTEGRATION_API_KEY"];
  if (!key) {
    throw new Error(
      "A integração com o Seu Instalador ainda não foi configurada (chave de acesso ausente).",
    );
  }

  const headers: Record<string, string> = {
    "X-Integration-Key": key,
    "X-External-User-Name": opts.userName,
    "X-Request-Id": crypto.randomUUID(),
  };
  if (opts.body !== undefined) headers["Content-Type"] = "application/json";
  if (opts.idempotencyKey) headers["Idempotency-Key"] = opts.idempotencyKey;

  let response: Response;
  try {
    response = await fetch(buildUrl(opts.path, opts.query), {
      method: opts.method || "GET",
      headers,
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
  } catch {
    throw new Error("Não foi possível falar com o Seu Instalador. Verifique a conexão e tente novamente.");
  }

  const text = await response.text();
  let payload: any = null;
  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const apiMessage = payload?.error?.message || payload?.message;
    throw new Error(messageForStatus(response.status, apiMessage, response.headers.get("Retry-After")));
  }

  return (payload ?? {}) as T;
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
        idempotencyKey: z.string().min(8),
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
