import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_tickets",
  title: "Listar atendimentos",
  description:
    "Lista atendimentos (chamados) com filtros opcionais de status, setor, placa, telefone e período de criação.",
  inputSchema: {
    status: z.string().optional().describe("Status do chamado, ex.: aberto, fechado."),
    sector: z.string().optional().describe("Nome do setor (busca parcial)."),
    plate: z.string().optional().describe("Placa do veículo (busca parcial)."),
    phone: z.string().optional().describe("Telefone do contato (busca parcial)."),
    created_from: z.string().optional().describe("Data inicial ISO (ex.: 2026-09-01)."),
    created_to: z.string().optional().describe("Data final ISO (ex.: 2026-09-30)."),
    limit: z.number().int().min(1).max(100).default(25).describe("Máximo de registros (1-100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("service_tickets")
      .select(
        "id, protocol_number, status, priority, sector, category, subcategory_name, plate, contact_name, contact_phone, assigned_to, created_at, closed_at, notes"
      )
      .order("created_at", { ascending: false })
      .limit(input.limit ?? 25);

    if (input.status) query = query.eq("status", input.status as any);
    if (input.sector) query = query.ilike("sector", `%${input.sector}%`);
    if (input.plate) query = query.ilike("plate", `%${input.plate}%`);
    if (input.phone) query = query.ilike("contact_phone", `%${input.phone}%`);
    if (input.created_from) query = query.gte("created_at", input.created_from);
    if (input.created_to) query = query.lte("created_at", input.created_to);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, tickets: data ?? [] },
    };
  },
});
