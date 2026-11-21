import { defineTool } from "@lovable.dev/mcp-js";
import { financeClient, fail, ok } from "./financeiro-shared";

export default defineTool({
  name: "financeiro_categorias",
  title: "Financeiro: categorias e empresas",
  description: "Lista as categorias ativas do Financeiro (nome, tipo, grupo do DRE) e as empresas do grupo (código, nome, CNPJ). Use antes de registrar documentos.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async (_input, ctx) => {
    const c = await financeClient(ctx);
    if ("error" in c) return fail(c.error);
    const [cats, emps] = await Promise.all([
      c.supabase.from("fin_categorias").select("nome, tipo, grupo_dre").eq("ativo", true).order("ordem"),
      c.supabase.from("fin_empresas").select("codigo, nome, cnpj").eq("ativo", true),
    ]);
    if (cats.error) return fail(cats.error.message);
    return ok({ categorias: cats.data ?? [], empresas: emps.data ?? [] });
  },
});
