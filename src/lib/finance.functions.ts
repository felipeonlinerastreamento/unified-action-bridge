import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { dicasDoNomeArquivo, parseValorBR, TIPOS_DOCUMENTO } from "@/lib/finance";

/** Bloqueia no servidor quem não está na lista do Financeiro (fin_acesso). */
export async function assertFinance(supabase: any) {
  const { data, error } = await supabase.rpc("can_access_finance");
  if (error || data !== true) throw new Error("Você não tem acesso ao Financeiro.");
}

export type LeituraComprovante = {
  contraparte: string | null;
  documento_contraparte: string | null;
  descricao: string | null;
  valor: number;
  data_emissao: string | null;
  vencimento: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  linha_digitavel: string | null;
  categoria: string | null;
  empresa: string | null;
  confianca: number;
};

function promptLeitura(categorias: string[], empresas: { codigo: string; nome: string; cnpj?: string | null }[]) {
  return (
    "Você lê comprovantes fiscais e boletos de uma empresa brasileira (rastreamento veicular) e devolve os dados para o contas a pagar. " +
    "Responda SOMENTE um JSON com as chaves: contraparte (quem recebe: fornecedor/beneficiário/estabelecimento), documento_contraparte (CNPJ/CPF dele), " +
    "descricao (curta, ex.: 'Mensalidade plataforma', 'Almoço com cliente'), valor (número, valor total a pagar), data_emissao (AAAA-MM-DD), vencimento (AAAA-MM-DD; " +
    "para cupom já pago use a data da compra), tipo_documento (um de: " + TIPOS_DOCUMENTO.map((t) => t.key).join(", ") + "), numero_documento, linha_digitavel, " +
    "categoria (exatamente um nome desta lista: " + categorias.join(" | ") + "), empresa (código do pagador: " +
    empresas.map((e) => `${e.codigo}=${e.nome}${e.cnpj ? ` CNPJ ${e.cnpj}` : ""}`).join("; ") + "; null se não der para saber), " +
    "confianca (0 a 1). Use null para o que não estiver no documento. Restaurante ou lanchonete com cliente: 'Almoço com cliente' só se o documento indicar; senão 'Alimentação'."
  );
}

/** Normaliza a resposta da IA para o formato do lançamento. */
export function normalizarLeitura(raw: any, categorias: string[]): LeituraComprovante {
  const s = (v: any) => (v == null || v === "" ? null : String(v).trim());
  const data = (v: any) => {
    const t = s(v);
    if (!t) return null;
    const m = t.match(/^(\d{4})-(\d{2})-(\d{2})/) || t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
    if (!m) return null;
    return m[1].length === 4 ? `${m[1]}-${m[2]}-${m[3]}` : `${m[3]}-${m[2]}-${m[1]}`;
  };
  const cat = s(raw?.categoria);
  const catOk = cat ? categorias.find((c) => c.toLowerCase() === cat.toLowerCase()) ?? null : null;
  const tipo = s(raw?.tipo_documento);
  return {
    contraparte: s(raw?.contraparte),
    documento_contraparte: s(raw?.documento_contraparte),
    descricao: s(raw?.descricao),
    valor: Math.abs(parseValorBR(raw?.valor)),
    data_emissao: data(raw?.data_emissao),
    vencimento: data(raw?.vencimento),
    tipo_documento: TIPOS_DOCUMENTO.some((t) => t.key === tipo) ? tipo : null,
    numero_documento: s(raw?.numero_documento),
    linha_digitavel: s(raw?.linha_digitavel),
    categoria: catOk,
    empresa: s(raw?.empresa),
    confianca: Math.max(0, Math.min(1, Number(raw?.confianca) || 0)),
  };
}

/**
 * Lê um comprovante enviado ao bucket fin-comprovantes com a IA do sistema (modelo com visão)
 * e cria o lançamento a pagar como "A revisar".
 */
export const lerComprovanteUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ path: z.string().min(3).max(500), nome: z.string().max(300) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertFinance(supabase);

    const [{ data: cats }, { data: emps }] = await Promise.all([
      supabase.from("fin_categorias").select("id, nome").eq("ativo", true).order("ordem"),
      supabase.from("fin_empresas").select("id, codigo, nome, cnpj").eq("ativo", true),
    ]);
    const nomesCat = (cats || []).map((c: any) => c.nome);

    const { data: blob, error: dlErr } = await supabase.storage.from("fin-comprovantes").download(data.path);
    if (dlErr || !blob) throw new Error("Não consegui abrir o arquivo enviado.");
    const buf = Buffer.from(await blob.arrayBuffer());
    const lower = data.nome.toLowerCase();
    const mime = lower.endsWith(".pdf") ? "application/pdf" : lower.endsWith(".png") ? "image/png" : lower.endsWith(".webp") ? "image/webp" : "image/jpeg";

    let leitura: LeituraComprovante = normalizarLeitura({}, nomesCat);
    const apiKey = process.env.LOVABLE_API_KEY;
    if (apiKey) {
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: promptLeitura(nomesCat, emps || []) },
            {
              role: "user",
              content: [
                { type: "text", text: `Arquivo: ${data.nome}` },
                { type: "image_url", image_url: { url: `data:${mime};base64,${buf.toString("base64")}` } },
              ],
            },
          ],
        }),
      });
      if (res.ok) {
        const json: any = await res.json();
        const txt = String(json?.choices?.[0]?.message?.content ?? "{}").replace(/^```json\s*|```$/g, "");
        try { leitura = normalizarLeitura(JSON.parse(txt), nomesCat); } catch { /* fica vazio para revisão manual */ }
      }
    }

    const dicas = dicasDoNomeArquivo(data.nome);
    const empresaCod = leitura.empresa || dicas.empresa;
    const empresa = (emps || []).find((e: any) => e.codigo === empresaCod);
    const categoria = (cats || []).find((c: any) => c.nome === leitura.categoria);

    const { data: novo, error } = await supabase
      .from("fin_lancamentos")
      .insert({
        tipo: "pagar",
        empresa_id: empresa?.id ?? null,
        categoria_id: categoria?.id ?? null,
        contraparte: leitura.contraparte || dicas.contraparte || null,
        documento_contraparte: leitura.documento_contraparte,
        descricao: leitura.descricao,
        valor: leitura.valor,
        data_emissao: leitura.data_emissao,
        vencimento: leitura.vencimento,
        tipo_documento: leitura.tipo_documento || dicas.tipoDocumento || null,
        numero_documento: leitura.numero_documento,
        linha_digitavel: leitura.linha_digitavel,
        origem: "upload",
        arquivo_nome: data.nome,
        arquivo_path: data.path,
        ia_confianca: leitura.confianca,
        revisado: false,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    return { id: novo.id as string, leitura };
  });

/** Link temporário para abrir um comprovante do bucket. */
export const linkComprovante = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(z.object({ path: z.string().min(3).max(500) }).parse)
  .handler(async ({ data, context }) => {
    const { supabase } = context as any;
    await assertFinance(supabase);
    const { data: signed, error } = await supabase.storage.from("fin-comprovantes").createSignedUrl(data.path, 600);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl as string };
  });
