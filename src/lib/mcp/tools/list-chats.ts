import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "list_chats",
  title: "Listar conversas do WhatsApp",
  description: "Lista as conversas da Central de Atendimento com filtros de status, setor e telefone.",
  inputSchema: {
    status: z.string().optional().describe("Status da conversa, ex.: open, closed, waiting."),
    sector: z.string().optional().describe("Nome do setor (busca parcial)."),
    phone: z.string().optional().describe("Telefone do contato (busca parcial)."),
    limit: z.number().int().min(1).max(100).default(25).describe("Máximo de registros (1-100)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase
      .from("zapi_chats")
      .select(
        "id, phone, contact_name, status, sector_name, assigned_to, unread_count, last_message_at, last_message_preview, created_at, closed_at"
      )
      .order("last_message_at", { ascending: false, nullsFirst: false })
      .limit(input.limit ?? 25);

    if (input.status) query = query.eq("status", input.status);
    if (input.sector) query = query.ilike("sector_name", `%${input.sector}%`);
    if (input.phone) query = query.ilike("phone", `%${input.phone}%`);

    const { data, error } = await query;
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data ?? [], null, 2) }],
      structuredContent: { count: data?.length ?? 0, chats: data ?? [] },
    };
  },
});
