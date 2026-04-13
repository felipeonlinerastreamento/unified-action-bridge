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
  .handler(async () => {
    const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");
    return gsystemApiFetch("/pendencias");
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

// ============================================================
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
