/**
 * GSystem Management API Server Functions
 * All endpoints for: Clientes, Veículos, Agendamentos, Faturas,
 * Pendências, Planos, Anexos, Cadastros, Parâmetros
 */

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

// We import server-only code inside handlers to avoid client bundle issues
// gsystem-api.server.ts is only used inside handler functions

// ============================================================
// CLIENTES
// ============================================================

export const getClientes = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      identifiers: z.string().max(500).optional(),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    const endpoint = data.identifiers
      ? `/clientes/${encodeURIComponent(data.identifiers)}`
      : "/clientes";
    return gsystemApiFetch(endpoint);
  });

export const createCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/clientes", "POST", data.body);
  });

export const updateCliente = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/clientes/${encodeURIComponent(data.key)}`, "PUT", data.body);
  });

// Client Contacts
export const getClienteContatos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ clientKey: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/clientes/contatos/${encodeURIComponent(data.clientKey)}`);
  });

export const createClienteContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientKey: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(
      `/clientes/contatos/${encodeURIComponent(data.clientKey)}`,
      "POST",
      data.body
    );
  });

export const updateClienteContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientKey: z.string().min(1).max(255),
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(
      `/clientes/contatos/${encodeURIComponent(data.clientKey)}/${encodeURIComponent(data.key)}`,
      "PUT",
      data.body
    );
  });

export const deleteClienteContato = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientKey: z.string().min(1).max(255),
      key: z.string().min(1).max(255),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(
      `/clientes/contatos/${encodeURIComponent(data.clientKey)}/${encodeURIComponent(data.key)}`,
      "DELETE"
    );
  });

// Client Addresses
export const getClienteEnderecos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ clientKey: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/clientes/enderecos/${encodeURIComponent(data.clientKey)}`);
  });

export const createClienteEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientKey: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(
      `/clientes/enderecos/${encodeURIComponent(data.clientKey)}`,
      "POST",
      data.body
    );
  });

export const updateClienteEndereco = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      clientKey: z.string().min(1).max(255),
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(
      `/clientes/enderecos/${encodeURIComponent(data.clientKey)}/${encodeURIComponent(data.key)}`,
      "PUT",
      data.body
    );
  });

// ============================================================
// VEÍCULOS
// ============================================================

export const getVeiculos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/veiculos");
  });

export const getVeiculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/veiculos/${encodeURIComponent(data.key)}`);
  });

export const createVeiculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ body: z.record(z.unknown()) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/veiculos", "POST", data.body);
  });

export const updateVeiculo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/veiculos/${encodeURIComponent(data.key)}`, "PUT", data.body);
  });

export const getVeiculoTipos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/veiculos/tipos");
  });

// ============================================================
// AGENDAMENTOS
// ============================================================

export const getAgendamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/agendamentos");
  });

export const getAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/agendamentos/${encodeURIComponent(data.key)}`);
  });

export const createAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/agendamentos/${encodeURIComponent(data.key)}`, "POST", data.body);
  });

export const updateAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/agendamentos/${encodeURIComponent(data.key)}`, "PUT", data.body);
  });

export const deleteAgendamento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/agendamentos/${encodeURIComponent(data.key)}`, "DELETE");
  });

// ============================================================
// FATURAS
// ============================================================

export const getFaturas = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ cpfCnpj: z.string().min(1).max(20) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/faturas/${encodeURIComponent(data.cpfCnpj)}`);
  });

// ============================================================
// PENDÊNCIAS
// ============================================================

export const getPendencias = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      dataInicial: z.string().min(1).max(20).optional(),
      dataFinal: z.string().min(1).max(20).optional(),
      clienteKey: z.string().max(255).optional(),
      veiculoKey: z.string().max(255).optional(),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    const parts: string[] = [];
    if (data.dataInicial) parts.push(`Data[Inicial]=${encodeURIComponent(data.dataInicial)}`);
    if (data.dataFinal) parts.push(`Data[Final]=${encodeURIComponent(data.dataFinal)}`);
    if (data.clienteKey) parts.push(`Cliente=${encodeURIComponent(data.clienteKey)}`);
    if (data.veiculoKey) parts.push(`Veiculo=${encodeURIComponent(data.veiculoKey)}`);
    const qs = parts.join("&");
    console.log("[GSystem Pendencias] Requesting /pendencias with query:", qs);
    return gsystemApiFetch(`/pendencias${qs ? `?${qs}` : ""}`);
  });

export const getPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/pendencias/${encodeURIComponent(data.key)}`);
  });

export const createPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ body: z.record(z.unknown()) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/pendencias", "POST", data.body);
  });

export const updatePendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(
      `/pendencias/${encodeURIComponent(data.key)}`,
      "PUT",
      data.body
    );
  });

export const cancelarPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/pendencias/${encodeURIComponent(data.key)}/cancelar`, "PUT");
  });

export const getTiposPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");

    // Tipos de pendência are stored as cadastros with Tipo = "Tipos_de_Pendência"
    try {
      const cadastros = await gsystemApiFetch("/cadastros");
      if (Array.isArray(cadastros)) {
        const tiposCadastro = cadastros.filter((c: any) => {
          const tipo = (c.Tipo || "").replace(/_/g, " ").toLowerCase();
          return tipo === "tipos de pendência" || tipo === "tipos de pendencia";
        });

        if (tiposCadastro.length > 0) {
          console.log(`[getTiposPendencia] Found ${tiposCadastro.length} tipos de pendência`);
          return tiposCadastro
            .filter((c: any) => c.Ativado !== false)
            .map((c: any) => ({
              Key: String(c.Codigo || c.DisplayName),
              Descricao: c.DisplayName || c.Texto || String(c.Codigo),
            }));
        }
      }
    } catch (err) {
      console.error("[getTiposPendencia] /cadastros failed:", String(err).substring(0, 200));
    }

    console.warn("[getTiposPendencia] No tipos de pendência found in cadastros");
    return [];
  });

// PLANOS
// ============================================================

export const getPlanos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/planos");
  });

export const getPlano = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/planos/${encodeURIComponent(data.key)}`);
  });

// ============================================================
// ANEXOS
// ============================================================

export const getAnexos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/anexos");
  });

export const getAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/anexos/${encodeURIComponent(data.key)}`);
  });

export const createAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ body: z.record(z.unknown()) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/anexos", "POST", data.body);
  });

export const updateAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/anexos/${encodeURIComponent(data.key)}`, "PUT", data.body);
  });

export const deleteAnexo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/anexos/${encodeURIComponent(data.key)}`, "DELETE");
  });

// ============================================================
// CADASTROS AUXILIARES
// ============================================================

export const getCadastros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/cadastros");
  });

export const getCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({ key: z.string().min(1).max(255) }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/cadastros/${encodeURIComponent(data.key)}`);
  });

export const createCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/cadastros/${encodeURIComponent(data.key)}`, "POST", data.body);
  });

export const updateCadastro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      key: z.string().min(1).max(255),
      body: z.record(z.unknown()),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch(`/cadastros/${encodeURIComponent(data.key)}`, "PUT", data.body);
  });

// List all distinct Tipo values present in /cadastros (useful for discovery)
export const listCadastroTipos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    try {
      const cadastros = await gsystemApiFetch("/cadastros");
      if (!Array.isArray(cadastros)) return [];
      const counts = new Map<string, number>();
      for (const c of cadastros as any[]) {
        const tipo = c?.Tipo ? String(c.Tipo) : "";
        if (!tipo) continue;
        counts.set(tipo, (counts.get(tipo) ?? 0) + 1);
      }
      return Array.from(counts.entries())
        .map(([tipo, count]) => ({ tipo, count }))
        .sort((a, b) => a.tipo.localeCompare(b.tipo));
    } catch (err) {
      console.error("[listCadastroTipos] failed:", String(err).substring(0, 200));
      return [];
    }
  });

// Fetch normalized cadastros filtered by one or more candidate Tipo names.
// Tries each candidate (case/underscore-insensitive) and returns the first match.
export const getCadastrosByTipo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      candidates: z.array(z.string().min(1).max(120)).min(1).max(20),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    const norm = (s: string) => String(s || "").replace(/_/g, " ").trim().toLowerCase();

    let cadastros: any[] = [];
    try {
      const result = await gsystemApiFetch("/cadastros");
      cadastros = Array.isArray(result) ? result : [];
    } catch (err) {
      console.error("[getCadastrosByTipo] /cadastros failed:", String(err).substring(0, 200));
      return { matchedTipo: null as string | null, items: [] as any[], availableTipos: [] as string[] };
    }

    // Build set of available tipos for diagnostics
    const tiposSet = new Set<string>();
    for (const c of cadastros) {
      if (c?.Tipo) tiposSet.add(String(c.Tipo));
    }
    const availableTipos = Array.from(tiposSet).sort();

    // Try each candidate
    const candidatesNorm = data.candidates.map(norm);
    let matchedTipo: string | null = null;
    const matched = cadastros.filter((c: any) => {
      const t = norm(c?.Tipo);
      const hit = candidatesNorm.includes(t);
      if (hit && !matchedTipo) matchedTipo = String(c.Tipo);
      return hit;
    });

    const items = matched.map((c: any) => {
      const ativadoFalse = c.Ativado === false;
      return {
        key: String(c.Codigo ?? c.Key ?? c.Id ?? c.DisplayName ?? ""),
        descricao: c.DisplayName ?? c.Texto ?? c.Descricao ?? "",
        modelo: c.Modelo ?? c.Categoria ?? c.SubTipo ?? c.Tipo ?? "",
        identificador: c.Serial ?? c.IMEI ?? c.ICCID ?? c.Numero ?? c.Codigo ?? "",
        status: c.Status ?? (ativadoFalse ? "Inativo" : "Disponível"),
        vinculo: c.Veiculo ?? c.Cliente ?? c.VinculadoA ?? null,
        raw: c,
      };
    });

    return { matchedTipo, items, availableTipos };
  });

// ============================================================
// EQUIPAMENTOS / CHIPS — descoberta automática
// ============================================================
//
// A API do GSystem hospeda equipamentos físicos em endpoints próprios
// (e não em /cadastros, que serve apenas para listas auxiliares).
// O nome exato do endpoint varia por instalação. Esta função tenta
// vários caminhos em ordem e devolve o primeiro que responder com lista.

const EQUIP_ENDPOINT_CANDIDATES = [
  "/equipamentos",
  "/equipamento",
  "/rastreadores",
  "/rastreador",
  "/dispositivos",
  "/aparelhos",
];

const CHIP_ENDPOINT_CANDIDATES = [
  "/chips",
  "/chip",
  "/sims",
  "/sim",
  "/simcards",
  "/linhas",
];

function normalizeEquipItem(c: any) {
  const ativadoFalse = c?.Ativado === false || c?.ativado === false;
  return {
    key: String(c?.Key ?? c?.Id ?? c?.Codigo ?? c?.IMEI ?? c?.Serial ?? ""),
    descricao: c?.Descricao ?? c?.descricao ?? c?.DisplayName ?? c?.Modelo ?? c?.Nome ?? "",
    modelo: c?.Modelo ?? c?.modelo ?? c?.Tipo ?? c?.Categoria ?? "",
    identificador: c?.Serial ?? c?.serial ?? c?.IMEI ?? c?.imei ?? c?.ICCID ?? c?.iccid ?? c?.Numero ?? c?.numero ?? c?.Codigo ?? "",
    status: c?.Status ?? c?.status ?? (ativadoFalse ? "Inativo" : "Disponível"),
    vinculo: c?.Veiculo ?? c?.veiculo ?? c?.Cliente ?? c?.cliente ?? c?.VinculadoA ?? null,
    raw: c,
  };
}

async function probeEndpoints(
  fetcher: (endpoint: string, method?: string, body?: unknown) => Promise<any>,
  endpoints: string[]
): Promise<{ matchedEndpoint: string | null; items: any[]; tried: Array<{ endpoint: string; status: string }> }> {
  const tried: Array<{ endpoint: string; status: string }> = [];
  for (const ep of endpoints) {
    try {
      const result = await fetcher(ep);
      if (Array.isArray(result)) {
        tried.push({ endpoint: ep, status: `ok (${result.length} itens)` });
        if (result.length > 0) {
          return { matchedEndpoint: ep, items: result, tried };
        }
      } else if (result && typeof result === "object") {
        // Some APIs wrap arrays in { data: [...] } or { Items: [...] }
        const arr = (result as any).data ?? (result as any).Data ?? (result as any).Items ?? (result as any).items ?? (result as any).resultado;
        if (Array.isArray(arr)) {
          tried.push({ endpoint: ep, status: `ok (${arr.length} itens, wrapped)` });
          if (arr.length > 0) {
            return { matchedEndpoint: ep, items: arr, tried };
          }
        } else {
          tried.push({ endpoint: ep, status: "resposta não-array" });
        }
      } else {
        tried.push({ endpoint: ep, status: "resposta vazia" });
      }
    } catch (err: any) {
      const msg = String(err?.message || err);
      const m = msg.match(/\[(\d{3})\]/);
      tried.push({ endpoint: ep, status: m ? `HTTP ${m[1]}` : msg.substring(0, 80) });
    }
  }
  return { matchedEndpoint: null, items: [], tried };
}

export const discoverEquipamentos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    const probe = await probeEndpoints(gsystemApiFetch, EQUIP_ENDPOINT_CANDIDATES);
    return {
      matchedEndpoint: probe.matchedEndpoint,
      items: probe.items.map(normalizeEquipItem),
      tried: probe.tried,
    };
  });

export const discoverChips = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    const probe = await probeEndpoints(gsystemApiFetch, CHIP_ENDPOINT_CANDIDATES);
    return {
      matchedEndpoint: probe.matchedEndpoint,
      items: probe.items.map(normalizeEquipItem),
      tried: probe.tried,
    };
  });

export const listEquipamentosFromVeiculos = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");

    let veiculos: any[] = [];
    try {
      const result = await gsystemApiFetch("/veiculos");
      veiculos = Array.isArray(result)
        ? result
        : (result?.data ?? result?.Data ?? result?.Items ?? result?.items ?? []);
    } catch (err) {
      console.error("[listEquipamentosFromVeiculos] /veiculos failed:", String(err).substring(0, 200));
      return { items: [] as any[], source: "veiculos" as const };
    }

    const items = veiculos
      .filter((v: any) => v?.Equipamento || v?.EquipamentoSecundario)
      .flatMap((v: any) => {
        const entries = [
          { equipamento: v?.Equipamento, secondary: false },
          { equipamento: v?.EquipamentoSecundario, secondary: true },
        ].filter((entry) => entry.equipamento);

        return entries.map(({ equipamento, secondary }) => {
          const eq = typeof equipamento === "object" ? equipamento : { DisplayName: String(equipamento), Equipamento: String(equipamento) };
          const status = v?.Status ?? "Ativado";
          return {
            key: String(eq?.Codigo ?? eq?.Key ?? eq?.Id ?? eq?.Equipamento ?? eq?.Serie ?? eq?.DisplayName ?? v?.Codigo ?? ""),
            descricao: eq?.DisplayName ?? eq?.Equipamento ?? eq?.Serie ?? (secondary ? "Equipamento secundário" : "Equipamento"),
            modelo: v?.Modelo ?? v?.Tipo ?? "",
            identificador: String(eq?.Equipamento ?? eq?.Serie ?? eq?.DisplayName ?? ""),
            status,
            vinculo: v?.Placa ?? v?.DisplayName ?? v?.Cliente ?? null,
            raw: {
              veiculoCodigo: v?.Codigo,
              veiculoPlaca: v?.Placa,
              cliente: v?.Cliente,
              equipamento: eq,
              secondary,
            },
          };
        });
      });

    const seen = new Set<string>();
    const deduped = items.filter((item) => {
      const key = `${item.identificador}::${item.vinculo ?? ""}`;
      if (!item.identificador || seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    return { items: deduped, source: "veiculos" as const };
  });

// Sondagem ampla para diagnóstico — tenta muitos endpoints e devolve um relatório completo
export const probeEquipamentosDeep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");

    const ENDPOINTS_TO_TRY = [
      "/equipamentos", "/equipamento", "/Equipamentos", "/Equipamento",
      "/rastreadores", "/rastreador", "/Rastreadores", "/Rastreador",
      "/dispositivos", "/dispositivo", "/Dispositivos",
      "/aparelhos", "/aparelho", "/Aparelhos",
      "/produtos", "/Produtos",
      "/itens", "/Itens",
      "/chips", "/chip", "/Chips", "/Chip",
      "/sims", "/sim", "/Sims",
      "/simcards", "/SimCards", "/simcard",
      "/linhas", "/Linhas", "/linha",
      "/estoque", "/Estoque", "/estoques",
      "/almoxarifado", "/Almoxarifado",
      "/inventario", "/Inventario",
    ];

    const summarizeSample = (item: any): Record<string, any> | null => {
      if (!item || typeof item !== "object") return null;
      const keys = Object.keys(item).slice(0, 25);
      const sample: Record<string, any> = {};
      for (const k of keys) {
        const v = (item as any)[k];
        if (v == null) sample[k] = null;
        else if (typeof v === "object") sample[k] = Array.isArray(v) ? `[array len=${v.length}]` : "{object}";
        else sample[k] = String(v).substring(0, 80);
      }
      return sample;
    };

    const results: Array<{
      endpoint: string;
      status: string;
      count?: number;
      firstItemKeys?: string[];
      sample?: Record<string, any> | null;
    }> = [];

    for (const ep of ENDPOINTS_TO_TRY) {
      try {
        const result = await gsystemApiFetch(ep);
        if (Array.isArray(result)) {
          results.push({
            endpoint: ep,
            status: "ok",
            count: result.length,
            firstItemKeys: result.length > 0 ? Object.keys(result[0]).slice(0, 30) : [],
            sample: result.length > 0 ? summarizeSample(result[0]) : null,
          });
        } else if (result && typeof result === "object") {
          const arr = (result as any).data ?? (result as any).Data ?? (result as any).Items
            ?? (result as any).items ?? (result as any).resultado ?? (result as any).Result;
          if (Array.isArray(arr)) {
            results.push({
              endpoint: ep,
              status: "ok-wrapped",
              count: arr.length,
              firstItemKeys: arr.length > 0 ? Object.keys(arr[0]).slice(0, 30) : [],
              sample: arr.length > 0 ? summarizeSample(arr[0]) : null,
            });
          } else {
            results.push({ endpoint: ep, status: "object-no-array", firstItemKeys: Object.keys(result).slice(0, 20) });
          }
        } else {
          results.push({ endpoint: ep, status: "empty-or-non-object" });
        }
      } catch (err: any) {
        const msg = String(err?.message || err);
        const m = msg.match(/\[(\d{3})\]/);
        results.push({ endpoint: ep, status: m ? `HTTP ${m[1]}` : msg.substring(0, 120) });
      }
    }

    let cadastrosByTipo: Array<{ tipo: string; count: number; sampleKeys?: string[] }> = [];
    try {
      const cadastros = await gsystemApiFetch("/cadastros");
      if (Array.isArray(cadastros)) {
        const map = new Map<string, { count: number; first: any | null }>();
        for (const c of cadastros as any[]) {
          const t = String(c?.Tipo ?? "").trim();
          if (!t) continue;
          const cur = map.get(t) ?? { count: 0, first: null };
          cur.count += 1;
          if (!cur.first) cur.first = c;
          map.set(t, cur);
        }
        cadastrosByTipo = Array.from(map.entries())
          .map(([tipo, v]) => ({
            tipo,
            count: v.count,
            sampleKeys: v.first ? Object.keys(v.first).slice(0, 25) : [],
          }))
          .sort((a, b) => b.count - a.count);
      }
    } catch (err) {
      cadastrosByTipo = [{ tipo: `__error__: ${String(err).substring(0, 120)}`, count: 0 }];
    }

    return {
      probedAt: new Date().toISOString(),
      endpoints: results,
      cadastrosByTipo,
      successfulEndpoints: results.filter((r) => r.status.startsWith("ok") && (r.count ?? 0) > 0),
    };
  });

// ============================================================
// PARÂMETROS
// ============================================================

export const getParametros = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/parametros");
  });

// ============================================================
// PENDÊNCIAS - ORQUESTRAÇÃO DE ATENDIMENTO
// ============================================================

/**
 * Creates a pendência in GSystem from a service ticket.
 * Handles client lookup/creation and sub-client mapping.
 */
export const createPendenciaFromAtendimento = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      attendanceId: z.string().min(1).max(255),
      contactPhone: z.string().max(30).optional(),
      contactName: z.string().max(255).optional(),
      companyId: z.string().max(255).optional(),
      subClientId: z.string().max(255).optional(),
      crmContactId: z.string().max(255).optional(),
      plate: z.string().max(20).optional(),
      notes: z.string().max(2000).optional(),
      tipoPendencia: z.string().max(255).optional(),
      status: z.string().max(50).optional(),
    }).parse
  )
  .handler(async ({ data, context }) => {
    const { gsystemApiFetch, findOrCreateGSystemClientByCompany } = await import("@/lib/gsystem-api.server");
    const { supabase } = context;

    let clienteKey: string | null = null;
    let observacao = "";
    let companyName = "";

    try {
      // 1. Sub-client flow: find parent company, use parent as GSystem client
      if (data.subClientId) {
        const { data: subClient } = await supabase
          .from("sub_clients")
          .select("*, companies(name, cnpj)")
          .eq("id", data.subClientId)
          .single();

        if (subClient) {
          const company = subClient.companies as any;
          companyName = company?.name || "";
          observacao = `Sub-cliente: ${subClient.name} | Tel: ${subClient.phone}${subClient.notes ? ` | ${subClient.notes}` : ""}`;

          clienteKey = await findOrCreateGSystemClientByCompany({
            name: company?.name || subClient.name,
            cnpj: company?.cnpj || null,
            phone: subClient.phone || data.contactPhone || null,
          });
        }
      }

      // 2. Direct company flow
      if (!clienteKey && data.companyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("name, cnpj, phone")
          .eq("id", data.companyId)
          .single();

        if (company) {
          companyName = company.name;
          const phone = company.phone || data.contactPhone || "";
          clienteKey = await findOrCreateGSystemClientByCompany({
            name: company.name,
            cnpj: company.cnpj || null,
            phone,
          });
        }
      }

      // 3. CRM contact flow (lead without company)
      if (!clienteKey && data.crmContactId) {
        const { data: contact } = await supabase
          .from("crm_contacts")
          .select("name, phone, company_id, companies(name, cnpj)")
          .eq("id", data.crmContactId)
          .single();

        if (contact) {
          const company = contact.companies as any;
          if (company) {
            companyName = company.name;
            clienteKey = await findOrCreateGSystemClientByCompany({
              name: company.name || contact.name,
              cnpj: company.cnpj || null,
              phone: contact.phone || null,
            });
          } else {
            // Create basic client from CRM contact
            clienteKey = await findOrCreateGSystemClientByCompany({
              name: contact.name,
              cnpj: null,
              phone: contact.phone || null,
            });
          }
        }
      }

      // 4. Fallback: create basic client from contact info
      if (!clienteKey && (data.contactName || data.contactPhone)) {
        clienteKey = await findOrCreateGSystemClientByCompany({
          name: data.contactName || "Contato",
          cnpj: null,
          phone: data.contactPhone || null,
        });
      }

      // Build pendência body
      const now = new Date();
      const pendenciaBody: Record<string, unknown> = {
        Descricao: `Atendimento via chat - ${companyName || data.contactName || data.contactPhone || "Contato"}`,
        DataAbertura: now.toISOString().split("T")[0],
        Observacao: [
          observacao,
          data.plate ? `Placa: ${data.plate}` : "",
          data.notes || "",
          `Atendimento ID: ${data.attendanceId}`,
          `Contato: ${data.contactName || ""} ${data.contactPhone || ""}`.trim(),
        ].filter(Boolean).join("\n"),
      };

      // TipoPendencia is required by GSystem API - default to "186" (Assuntos Diversos) if not provided
      pendenciaBody.TipoPendencia = data.tipoPendencia || "186";

      if (data.status) {
        pendenciaBody.Situacao = data.status;
      }

      if (clienteKey) {
        pendenciaBody.Cliente = clienteKey;
      }
      pendenciaBody.Veiculos = [];

      console.log("[Pendencia] Creating pendência:", JSON.stringify(pendenciaBody).substring(0, 500));

      const result = await gsystemApiFetch("/pendencias", "POST", pendenciaBody);

      // Extract the key from the result
      const pendenciaKey = result?.Key || result?.key || result?.Id || result?.id || null;

      return {
        success: true,
        pendenciaKey: typeof pendenciaKey === "string" ? pendenciaKey : pendenciaKey ? String(pendenciaKey) : null,
        clienteKey,
        message: "Pendência criada com sucesso",
      };
    } catch (err: any) {
      console.error("[Pendencia] Error creating pendência:", err.message);
      return {
        success: false,
        pendenciaKey: null,
        clienteKey: null,
        message: `Erro ao criar pendência: ${err.message}`,
      };
    }
  });

/**
 * Conclude (cancel) a pendência in GSystem when chat is finalized.
 */
export const concluirPendencia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    z.object({
      pendenciaKey: z.string().min(1).max(255),
      notes: z.string().max(2000).optional(),
    }).parse
  )
  .handler(async ({ data }) => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    try {
      await gsystemApiFetch(`/pendencias/${encodeURIComponent(data.pendenciaKey)}/cancelar`, "PUT");
      return { success: true, message: "Pendência concluída" };
    } catch (err: any) {
      console.error("[Pendencia] Error concluding pendência:", err.message);
      return { success: false, message: `Erro ao concluir pendência: ${err.message}` };
    }
  });

/**
 * Helper: find a client in GSystem by CNPJ or create a basic one.
 */
async function findOrCreateGSystemClient(
  gsystemApiFetch: (endpoint: string, method?: string, body?: unknown) => Promise<any>,
  cnpj: string | null,
  name: string,
  phone: string
): Promise<string | null> {
  // Try to find by CNPJ
  if (cnpj) {
    try {
      const cleanCnpj = cnpj.replace(/\D/g, "");
      const result = await gsystemApiFetch(`/clientes/${encodeURIComponent(cleanCnpj)}`);
      if (result) {
        const key = Array.isArray(result)
          ? result[0]?.Key || result[0]?.key
          : result?.Key || result?.key;
        if (key) return String(key);
      }
    } catch (err: any) {
      console.log("[Pendencia] Client not found by CNPJ, will create:", err.message);
    }
  }

  // Create basic client
  try {
    const clientBody: Record<string, unknown> = {
      Nome: name,
      Telefone: phone,
    };
    if (cnpj) clientBody.CNPJ = cnpj.replace(/\D/g, "");

    const created = await gsystemApiFetch("/clientes", "POST", clientBody);
    const key = created?.Key || created?.key || created?.Id || created?.id;
    if (key) return String(key);
  } catch (err: any) {
    console.error("[Pendencia] Error creating client:", err.message);
  }

  return null;
}

// ============================================================
// TESTE DE AUTENTICAÇÃO
// ============================================================

export const testGsystemAuth = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const GSYSTEM_API_BASE = "https://api.gsystem.com.br/api";
    const cnpj = process.env.GSYSTEM_CNPJ;
    const login = process.env.GSYSTEM_LOGIN;
    const passwordHash = process.env.GSYSTEM_PASSWORD_HASH;

    if (!cnpj || !login || !passwordHash) {
      return {
        success: false,
        message: "Credenciais não configuradas. Verifique GSYSTEM_CNPJ, GSYSTEM_LOGIN e GSYSTEM_PASSWORD_HASH.",
        details: {
          hasCnpj: !!cnpj,
          hasLogin: !!login,
          hasPassword: !!passwordHash,
        },
      };
    }

    const results: Array<{ field: string; status: number; message: string; success: boolean; keys?: string[]; jwtInfo?: string }> = [];

    // Attempt 1: PasswordHash
    try {
      const res1 = await fetch(`${GSYSTEM_API_BASE}/Auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ CNPJ: cnpj, Login: login, PasswordHash: passwordHash }),
      });
      const text1 = await res1.text();
      let keys1: string[] = [];
      let jwtInfo1 = "";
      try {
        const j = JSON.parse(text1);
        keys1 = typeof j === "object" && j !== null ? Object.keys(j) : [];
        if (j?.JWT !== undefined) {
          jwtInfo1 = `type=${typeof j.JWT}, value=${JSON.stringify(j.JWT).substring(0, 300)}`;
        }
      } catch {}
      results.push({ field: "PasswordHash", status: res1.status, message: text1.substring(0, 500), success: res1.ok, keys: keys1, jwtInfo: jwtInfo1 });
    } catch (err: any) {
      results.push({ field: "PasswordHash", status: 0, message: err.message, success: false });
    }

    // Attempt 2: Password
    try {
      const res2 = await fetch(`${GSYSTEM_API_BASE}/Auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ CNPJ: cnpj, Login: login, Password: passwordHash }),
      });
      const text2 = await res2.text();
      let keys2: string[] = [];
      try { const j = JSON.parse(text2); keys2 = typeof j === "object" && j !== null ? Object.keys(j) : []; } catch {}
      results.push({ field: "Password", status: res2.status, message: text2.substring(0, 500), success: res2.ok, keys: keys2 });
    } catch (err: any) {
      results.push({ field: "Password", status: 0, message: err.message, success: false });
    }

    // Attempt 3: Senha
    try {
      const res3 = await fetch(`${GSYSTEM_API_BASE}/Auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ CNPJ: cnpj, Login: login, Senha: passwordHash }),
      });
      const text3 = await res3.text();
      let keys3: string[] = [];
      try { const j = JSON.parse(text3); keys3 = typeof j === "object" && j !== null ? Object.keys(j) : []; } catch {}
      results.push({ field: "Senha", status: res3.status, message: text3.substring(0, 500), success: res3.ok, keys: keys3 });
    } catch (err: any) {
      results.push({ field: "Senha", status: 0, message: err.message, success: false });
    }

    const successAttempt = results.find((r) => r.success);

    return {
      success: !!successAttempt,
      workingField: successAttempt?.field || null,
      responseKeys: successAttempt?.keys || [],
      message: successAttempt
        ? `Autenticação bem-sucedida usando o campo "${successAttempt.field}". Chaves da resposta: ${(successAttempt.keys || []).join(", ")}`
        : "Nenhum formato de senha funcionou. Verifique o valor do secret GSYSTEM_PASSWORD_HASH.",
      attempts: results.map((r) => ({ field: r.field, status: r.status, success: r.success, message: r.message, keys: r.keys, jwtInfo: r.jwtInfo })),
    };
  });
