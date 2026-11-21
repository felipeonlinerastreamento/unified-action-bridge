import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { financeClient, fail, ok } from "./financeiro-shared";

const GRUPOS = [
  "Receita bruta", "Outras receitas", "Custo dos serviços", "Impostos", "Pessoal", "Despesas comerciais",
  "Despesas administrativas", "Despesas operacionais", "Despesas financeiras", "Outras despesas",
] as const;

export default defineTool({
  name: "financeiro_criar_categoria",
  title: "Financeiro: criar categoria",
  description:
    "Cria uma categoria nova no Financeiro (ou reativa uma existente com o mesmo nome). Use SOMENTE depois que o usuário confirmar o nome da categoria nova.",
  inputSchema: {
    nome: z.string().trim().min(2).max(80),
    tipo: z.enum(["despesa", "receita"]).default("despesa"),
    grupo_dre: z.enum(GRUPOS).default("Despesas operacionais").describe("Grupo do DRE onde a categoria soma."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const c = await financeClient(ctx);
    if ("error" in c) return fail(c.error);
    const { data: existente } = await c.supabase.from("fin_categorias").select("id, nome, ativo").ilike("nome", input.nome).maybeSingle();
    if (existente) {
      if (!existente.ativo) await c.supabase.from("fin_categorias").update({ ativo: true }).eq("id", existente.id);
      return ok({ criada: false, id: existente.id, nome: existente.nome, mensagem: "Já existia; foi usada a existente." });
    }
    const { data, error } = await c.supabase
      .from("fin_categorias")
      .insert({ nome: input.nome, tipo: input.tipo, grupo_dre: input.grupo_dre })
      .select("id, nome")
      .single();
    if (error) return fail(error.message);
    return ok({ criada: true, id: data.id, nome: data.nome });
  },
});
