import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { financeClient, fail, ok } from "./financeiro-shared";

export default defineTool({
  name: "financeiro_documentos_registrados",
  title: "Financeiro: arquivos já registrados",
  description: "Recebe uma lista de IDs de arquivos do Google Drive e devolve quais já foram registrados no Financeiro, para não lançar de novo.",
  inputSchema: {
    drive_file_ids: z.array(z.string().min(5).max(200)).min(1).max(200).describe("IDs dos arquivos no Google Drive."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (input, ctx) => {
    const c = await financeClient(ctx);
    if ("error" in c) return fail(c.error);
    const { data, error } = await c.supabase
      .from("fin_lancamentos")
      .select("id, drive_file_id, revisado, status")
      .in("drive_file_id", input.drive_file_ids);
    if (error) return fail(error.message);
    const registrados = (data ?? []).map((d: any) => d.drive_file_id);
    return ok({ registrados, novos: input.drive_file_ids.filter((id: string) => !registrados.includes(id)) });
  },
});
