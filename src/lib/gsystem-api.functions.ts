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
    return gsystemApiFetch("/pendencias/tipos");
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
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
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

          if (company?.cnpj) {
            clienteKey = await findOrCreateGSystemClient(gsystemApiFetch, company.cnpj, company.name, subClient.phone);
          }
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
          if (company.cnpj) {
            clienteKey = await findOrCreateGSystemClient(gsystemApiFetch, company.cnpj, company.name, phone);
          }
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
          if (company?.cnpj) {
            companyName = company.name;
            clienteKey = await findOrCreateGSystemClient(gsystemApiFetch, company.cnpj, company.name, contact.phone);
          } else {
            // Create basic client from CRM contact
            clienteKey = await findOrCreateGSystemClient(gsystemApiFetch, null, contact.name, contact.phone);
          }
        }
      }

      // 4. Fallback: create basic client from contact info
      if (!clienteKey && (data.contactName || data.contactPhone)) {
        clienteKey = await findOrCreateGSystemClient(gsystemApiFetch, null, data.contactName || "Contato", data.contactPhone || "");
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

      if (clienteKey) {
        pendenciaBody.Cliente = clienteKey;
      }

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
