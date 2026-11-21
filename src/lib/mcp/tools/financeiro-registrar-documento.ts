import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { financeClient, fail, ok } from "./financeiro-shared";
import { dicasDoNomeArquivo, TIPOS_DOCUMENTO } from "@/lib/finance";

const dataISO = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable();

export default defineTool({
  name: "financeiro_registrar_documento",
  title: "Financeiro: registrar documento do Drive",
  description:
    "Cria um lançamento a pagar (status aberto, 'A revisar') a partir de um comprovante/boleto/nota lido do Google Drive. " +
    "Não duplica: se o drive_file_id já existir, devolve o lançamento existente. Categoria e empresa são pelo nome/código de financeiro_categorias.",
  inputSchema: {
    drive_file_id: z.string().min(5).max(200),
    arquivo_nome: z.string().max(300),
    arquivo_url: z.string().url().max(1000).optional(),
    empresa: z.string().max(20).optional().nullable().describe("Código da empresa pagadora (ex.: OR)."),
    tipo_documento: z.enum(TIPOS_DOCUMENTO.map((t) => t.key) as [string, ...string[]]).optional().nullable(),
    contraparte: z.string().max(200).optional().nullable().describe("Fornecedor/beneficiário."),
    documento_contraparte: z.string().max(30).optional().nullable().describe("CNPJ/CPF do fornecedor."),
    descricao: z.string().max(500).optional().nullable(),
    categoria: z.string().max(100).optional().nullable().describe("Nome exato de uma categoria ativa."),
    valor: z.number().min(0).max(100000000),
    data_emissao: dataISO,
    vencimento: dataISO,
    competencia: dataISO.describe("Qualquer dia do mês de competência."),
    linha_digitavel: z.string().max(120).optional().nullable(),
    numero_documento: z.string().max(80).optional().nullable(),
    confianca: z.number().min(0).max(1).optional(),
    pago: z.boolean().optional().describe("true para cupom/recibo já pago (usa vencimento como data de pagamento)."),
  },
  annotations: { readOnlyHint: false, idempotentHint: true, destructiveHint: false, openWorldHint: false },
  handler: async (input, ctx) => {
    const c = await financeClient(ctx);
    if ("error" in c) return fail(c.error);
    const sb = c.supabase;

    const { data: existente } = await sb.from("fin_lancamentos").select("id, revisado").eq("drive_file_id", input.drive_file_id).maybeSingle();
    if (existente) return ok({ criado: false, id: existente.id, mensagem: "Já registrado; nada foi alterado." });

    const dicas = dicasDoNomeArquivo(input.arquivo_nome);
    const [{ data: cat }, { data: emp }] = await Promise.all([
      input.categoria ? sb.from("fin_categorias").select("id").ilike("nome", input.categoria).maybeSingle() : Promise.resolve({ data: null }),
      sb.from("fin_empresas").select("id").eq("codigo", (input.empresa || dicas.empresa || "OR").toUpperCase()).maybeSingle(),
    ]);

    const { data, error } = await sb
      .from("fin_lancamentos")
      .insert({
        tipo: "pagar",
        empresa_id: emp?.id ?? null,
        categoria_id: cat?.id ?? null,
        contraparte: input.contraparte || dicas.contraparte || null,
        documento_contraparte: input.documento_contraparte ?? null,
        descricao: input.descricao ?? null,
        valor: input.valor,
        data_emissao: input.data_emissao ?? null,
        vencimento: input.vencimento ?? null,
        competencia: input.competencia ?? null,
        status: input.pago ? "pago" : "aberto",
        data_pagamento: input.pago ? input.vencimento ?? input.data_emissao ?? null : null,
        valor_pago: input.pago ? input.valor : null,
        tipo_documento: input.tipo_documento || dicas.tipoDocumento || null,
        numero_documento: input.numero_documento ?? null,
        linha_digitavel: input.linha_digitavel ?? null,
        origem: "drive",
        drive_file_id: input.drive_file_id,
        arquivo_nome: input.arquivo_nome,
        arquivo_url: input.arquivo_url ?? null,
        ia_confianca: input.confianca ?? null,
        revisado: false,
      })
      .select("id")
      .single();
    if (error) {
      if (String(error.code) === "23505") return ok({ criado: false, mensagem: "Já registrado." });
      return fail(error.message);
    }
    return ok({ criado: true, id: data.id, categoria_encontrada: !!cat, empresa_encontrada: !!emp });
  },
});
