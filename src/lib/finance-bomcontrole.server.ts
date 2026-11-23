/**
 * Importação do Bom Controle (API de integração) para o Financeiro. Só roda no servidor.
 * Chave: variável BOMCONTROLE_API_KEY ou, se não houver, a salva em Configurações › Integrações
 * (tabela integracoes_segredos, só service role). Cada chamada trata uma página de uma janela
 * mensal, para caber no tempo da requisição; a tela repete até acabar.
 */
import {
  converterParcela, ehDuplicataGsystem, semAcento, somarResumo,
  type LancamentoBomControle, type LinhaResumo, type RecebivelGsystem,
} from "./finance-bomcontrole";
import { formatarDocumento } from "./finance-gsystem";

const BASE = "https://apinewintegracao.bomcontrole.com.br/integracao";
const CHAVE = "BOMCONTROLE_API_KEY";
const POR_PAGINA = 100;

async function adminDb(): Promise<any> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as any;
}

let cache: { em: number; chave: string | null; origem: "ambiente" | "tela" | null } | null = null;
export const limparCacheBomControle = () => { cache = null; };

export async function configBomControle() {
  if (cache && Date.now() - cache.em < 60_000) return cache;
  const env = process.env.BOMCONTROLE_API_KEY || null;
  let salva: string | null = null;
  try {
    const { data } = await (await adminDb()).from("integracoes_segredos").select("valor").eq("chave", CHAVE).maybeSingle();
    salva = data?.valor ?? null;
  } catch { /* sem tabela: só ambiente */ }
  const c = env || salva;
  cache = { em: Date.now(), chave: c ? limparChave(c) : null, origem: env ? "ambiente" : salva ? "tela" : null };
  return cache;
}

/** Limpa o que costuma vir junto ao colar: "ApiKey " na frente, aspas, espaços e quebras de linha. */
export function limparChave(c: string): string {
  return c.replace(/[\s"'“”‘’]+/g, " ").trim().replace(/^(authorization:\s*)?(apikey|bearer)\s+/i, "").replace(/\s+/g, "");
}

export async function salvarChaveBomControle(chaveBruta: string, userId: string) {
  const chave = limparChave(chaveBruta);
  const db = await adminDb();
  if (!chave) await db.from("integracoes_segredos").delete().eq("chave", CHAVE);
  else {
    const { error } = await db.from("integracoes_segredos").upsert({ chave: CHAVE, valor: chave, updated_by: userId, updated_at: new Date().toISOString() });
    if (error) throw new Error(`Não foi possível salvar (${error.message}).`);
  }
  limparCacheBomControle();
}

async function bcGet(caminho: string, params: Record<string, string | number | boolean>) {
  const { chave } = await configBomControle();
  if (!chave) throw new Error("Chave da API do Bom Controle não configurada. Cadastre em Configurações › Integrações.");
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  const res = await fetch(`${BASE}/${caminho}?${qs}`, { headers: { Authorization: `ApiKey ${chave}`, Accept: "application/json" } });
  const txt = await res.text();
  let json: any = null;
  try { json = JSON.parse(txt); } catch { /* não-JSON */ }
  if (!res.ok) {
    const msg = json?.Message || json?.message || json?.Mensagem || txt.slice(0, 200) || `HTTP ${res.status}`;
    throw new Error(res.status === 401 || res.status === 403
      ? `Bom Controle recusou a chave (${res.status}). Confira no Bom Controle (Configurações › Configuração de API Key) se a chave está ativa, se foi copiada inteira pelo botão "Copiar API Key" e se tem acesso ao módulo Financeiro e à empresa certa.${msg && !/^HTTP/.test(msg) ? ` Resposta: ${String(msg).slice(0, 150)}` : ""}`
      : `Bom Controle: ${msg}`);
  }
  return json;
}

/** Testa a chave com uma consulta leve (1 lançamento dos últimos 30 dias). */
export async function testarBomControle(): Promise<{ ok: boolean; erro: string | null; total: number | null }> {
  try {
    const hoje = new Date().toISOString().slice(0, 10);
    const inicio = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const r = await bcGet("Financeiro/Pesquisar", {
      dataInicio: `${inicio} 00:00:00`, dataTermino: `${hoje} 23:59:59`, tipoData: "DataPadrao",
      "paginacao.itensPorPagina": 1, "paginacao.numeroDaPagina": 1,
    });
    return { ok: true, erro: null, total: Number(r?.TotalItens ?? 0) };
  } catch (e: any) {
    return { ok: false, erro: String(e?.message ?? e), total: null };
  }
}

export type ResultadoPagina = {
  lidos: number;
  novos: number;
  atualizados: number;
  ignoradosGsystem: number;
  clientesGsystem: number; // recebíveis de clientes do GSystem sem fatura igual (não importados)
  ignoradosOutros: number;
  categoriasNovas: string[];
  empresasSemCadastro: string[];
  resumo: Record<string, LinhaResumo>;
  totalItens: number;
  proximaPagina: number | null;
};

/**
 * Lê uma página do período e, se `gravar`, grava. Recebíveis: não importa o que já veio do GSystem
 * nem (por padrão) o que for de cliente do GSystem sem fatura igual, para não duplicar mensalidades.
 */
export async function processarPaginaBomControle(opts: {
  de: string; ate: string; pagina: number; gravar: boolean; incluirClientesGsystem: boolean; userId: string;
}): Promise<ResultadoPagina> {
  const db = await adminDb();
  const r = await bcGet("Financeiro/Pesquisar", {
    dataInicio: `${opts.de} 00:00:00`, dataTermino: `${opts.ate} 23:59:59`, tipoData: "DataPadrao",
    buscarTransferencias: false, "paginacao.itensPorPagina": POR_PAGINA, "paginacao.numeroDaPagina": opts.pagina,
  });
  const itens: any[] = Array.isArray(r?.Itens) ? r.Itens : Array.isArray(r) ? r : [];
  const totalItens = Number(r?.TotalItens ?? itens.length);
  const convertidos: LancamentoBomControle[] = [];
  let ignoradosOutros = 0;
  for (const it of itens) {
    const l = converterParcela(it);
    if (l) convertidos.push(l); else ignoradosOutros++;
  }

  // Recebíveis do GSystem perto dessas datas e documentos.
  const docs = [...new Set(convertidos.filter((l) => l.tipo === "receber" && l.documento).map((l) => l.documento!))];
  let gsystem: RecebivelGsystem[] = [];
  const docsGsystem = new Set<string>();
  if (docs.length) {
    const formatados = docs.map(formatarDocumento);
    const { data, error } = await db.from("fin_lancamentos")
      .select("documento_contraparte, vencimento, valor")
      .eq("origem", "gsystem").in("documento_contraparte", [...formatados, ...docs]);
    if (error) throw error;
    gsystem = (data || []).map((g: any) => ({ documento: g.documento_contraparte, vencimento: g.vencimento, valor: Number(g.valor) }));
    for (const g of gsystem) if (g.documento) docsGsystem.add(g.documento.replace(/\D/g, ""));
  }

  const ids = convertidos.map((l) => l.parcelaId);
  const { data: existentes, error: e1 } = ids.length
    ? await db.from("fin_lancamentos").select("id, bomcontrole_parcela_id, status").in("bomcontrole_parcela_id", ids)
    : { data: [], error: null };
  if (e1) throw new Error(`${e1.message}. Confira se a migração 0068 foi aplicada.`);
  const porId = new Map<number, any>((existentes || []).map((e: any) => [Number(e.bomcontrole_parcela_id), e]));

  const [{ data: cats }, { data: empresas }, { data: contas }] = await Promise.all([
    db.from("fin_categorias").select("id, nome, tipo"),
    db.from("fin_empresas").select("id, codigo, nome, cnpj"),
    db.from("fin_contas_bancarias").select("id, nome, banco, conta"),
  ]);
  const catPorNome = new Map<string, string>((cats || []).map((c: any) => [semAcento(c.nome), c.id]));
  const empPorDoc = new Map<string, string>((empresas || []).filter((e: any) => e.cnpj).map((e: any) => [String(e.cnpj).replace(/\D/g, ""), e.id]));
  const empPadrao = (empresas || []).find((e: any) => e.codigo === "OR")?.id ?? null;
  const contaDe = (l: LancamentoBomControle): string | null => {
    const num = (l.contaBancaria.conta ?? "").replace(/\D/g, "");
    const nome = semAcento(l.contaBancaria.nome ?? "");
    const c = (contas || []).find((c: any) =>
      (num && String(c.conta ?? "").replace(/\D/g, "").includes(num)) || (nome && semAcento(c.nome) === nome));
    if (c) return c.id;
    // Pelo banco (Itaú, Bradesco, Inter), só quando há uma conta só daquele banco.
    const banco = semAcento(`${l.contaBancaria.banco ?? ""} ${l.contaBancaria.nome ?? ""}`);
    const doBanco = (contas || []).filter((c: any) => c.banco && banco.includes(semAcento(c.banco)));
    return doBanco.length === 1 ? doBanco[0].id : null;
  };

  const categoriasNovas = new Set<string>();
  const empresasSemCadastro = new Set<string>();
  const classificados: { l: LancamentoBomControle; situacao: "novo" | "existente" | "gsystem" }[] = [];
  let clientesGsystem = 0;
  for (const l of convertidos) {
    if (ehDuplicataGsystem(l, gsystem)) { classificados.push({ l, situacao: "gsystem" }); continue; }
    if (l.tipo === "receber" && l.documento && docsGsystem.has(l.documento) && !opts.incluirClientesGsystem && !porId.has(l.parcelaId)) {
      clientesGsystem++; continue;
    }
    classificados.push({ l, situacao: porId.has(l.parcelaId) ? "existente" : "novo" });
    if (l.categoria && !catPorNome.has(semAcento(l.categoria))) categoriasNovas.add(`${l.categoria}|${l.categoriaDespesa ? "despesa" : "receita"}`);
    if (l.empresaDocumento && !empPorDoc.has(l.empresaDocumento)) empresasSemCadastro.add(`${l.empresaNome ?? ""} (${formatarDocumento(l.empresaDocumento)})`);
  }

  let novos = 0, atualizados = 0;
  if (opts.gravar) {
    for (const item of categoriasNovas) {
      const [nome, tipo] = item.split("|");
      const { data, error } = await db.from("fin_categorias")
        .upsert({ nome, tipo, grupo_dre: tipo === "receita" ? "Outras receitas" : "Outras despesas", ordem: 900 }, { onConflict: "nome", ignoreDuplicates: false })
        .select("id").single();
      if (error) throw error;
      catPorNome.set(semAcento(nome), data.id);
    }
    const inserir: any[] = [];
    for (const { l, situacao } of classificados) {
      if (situacao === "gsystem") continue;
      const atual = porId.get(l.parcelaId);
      if (atual) {
        // Só acompanha a baixa: o que foi editado no nosso Financeiro não é sobrescrito.
        if (atual.status === "aberto" && l.status === "pago") {
          const { error } = await db.from("fin_lancamentos")
            .update({ status: "pago", data_pagamento: l.dataPagamento, valor_pago: l.valorPago }).eq("id", atual.id);
          if (error) throw error;
          atualizados++;
        }
        continue;
      }
      inserir.push({
        tipo: l.tipo,
        empresa_id: (l.empresaDocumento && empPorDoc.get(l.empresaDocumento)) || empPadrao,
        conta_bancaria_id: contaDe(l),
        categoria_id: l.categoria ? catPorNome.get(semAcento(l.categoria)) ?? null : null,
        contraparte: l.contraparte,
        documento_contraparte: l.documento ? formatarDocumento(l.documento) : null,
        descricao: l.descricao,
        valor: l.valor,
        data_emissao: l.dataEmissao,
        vencimento: l.vencimento,
        competencia: l.competencia,
        status: l.status,
        data_pagamento: l.dataPagamento,
        valor_pago: l.valorPago,
        forma_pagamento: l.formaPagamento,
        numero_documento: l.numeroDocumento,
        arquivo_url: l.link,
        origem: "bomcontrole",
        bomcontrole_parcela_id: l.parcelaId,
        revisado: true,
        observacao: l.observacao,
        created_by: opts.userId,
      });
    }
    if (inserir.length) {
      const { error } = await db.from("fin_lancamentos").upsert(inserir, { onConflict: "bomcontrole_parcela_id", ignoreDuplicates: true });
      if (error) throw new Error(`Falha ao gravar: ${error.message}`);
      novos = inserir.length;
    }
  } else {
    novos = classificados.filter((c) => c.situacao === "novo").length;
  }

  const lidosAteAqui = (opts.pagina - 1) * POR_PAGINA + itens.length;
  return {
    lidos: itens.length,
    novos,
    atualizados,
    ignoradosGsystem: classificados.filter((c) => c.situacao === "gsystem").length,
    clientesGsystem,
    ignoradosOutros,
    categoriasNovas: [...categoriasNovas].map((c) => c.split("|")[0]),
    empresasSemCadastro: [...empresasSemCadastro],
    resumo: somarResumo({}, classificados, opts.de.slice(0, 7)),
    totalItens,
    proximaPagina: itens.length === POR_PAGINA && lidosAteAqui < totalItens ? opts.pagina + 1 : null,
  };
}

export async function registrarImportacao(reg: {
  de: string; ate: string; novos: number; atualizados: number; ignoradosGsystem: number; ignoradosOutros: number;
  totalPagar: number; totalReceber: number; userId: string;
}) {
  const db = await adminDb();
  await db.from("fin_bomcontrole_importacoes").insert({
    de: reg.de, ate: reg.ate, novos: reg.novos, atualizados: reg.atualizados,
    ignorados_gsystem: reg.ignoradosGsystem, ignorados_outros: reg.ignoradosOutros,
    total_pagar: reg.totalPagar, total_receber: reg.totalReceber, created_by: reg.userId,
  });
}

export async function situacaoBomControle() {
  const db = await adminDb();
  const cfg = await configBomControle();
  const [{ count }, { data: ultima }] = await Promise.all([
    db.from("fin_lancamentos").select("id", { count: "exact", head: true }).eq("origem", "bomcontrole"),
    db.from("fin_bomcontrole_importacoes").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return {
    configurado: !!cfg.chave,
    origem: cfg.origem,
    finalChave: cfg.chave ? cfg.chave.slice(-4) : null,
    importados: count ?? 0,
    ultima: ultima ?? null,
  };
}
