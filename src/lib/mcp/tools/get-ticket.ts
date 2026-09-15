import { defineTool, ToolError } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

export default defineTool({
  name: "get_ticket",
  title: "Detalhes do atendimento",
  description: "Retorna os detalhes de um atendimento pelo número de protocolo ou pelo id.",
  inputSchema: {
    protocol_number: z.number().int().optional().describe("Número do protocolo do chamado."),
    ticket_id: z.string().uuid().optional().describe("Identificador do chamado."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text", text: "Não autenticado" }], isError: true };
    }
    if (!input.protocol_number && !input.ticket_id) {
      throw new ToolError("Informe protocol_number ou ticket_id.");
    }
    const supabase = supabaseForUser(ctx);
    let query = supabase.from("service_tickets").select("*").limit(1);
    if (input.ticket_id) query = query.eq("id", input.ticket_id);
    else query = query.eq("protocol_number", input.protocol_number!);

    const { data, error } = await query.maybeSingle();
    if (error) return { content: [{ type: "text", text: error.message }], isError: true };
    if (!data) return { content: [{ type: "text", text: "Atendimento não encontrado." }], isError: true };

    return {
      content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
      structuredContent: { ticket: data },
    };
  },
});
