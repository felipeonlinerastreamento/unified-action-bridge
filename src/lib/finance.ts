// Regras puras do módulo Financeiro (BPO). Sem acesso a banco: testáveis em finance.test.ts.

export type FinTipo = "pagar" | "receber";
export type FinStatus = "aberto" | "pago" | "cancelado";
export type FinStatusVisivel = FinStatus | "vencido";

export type FinLancamento = {
  id: string;
  tipo: FinTipo;
  valor: number;
  vencimento?: string | null;
  data_pagamento?: string | null;
  valor_pago?: number | null;
  competencia?: string | null;
  status: FinStatus;
  categoria_id?: string | null;
  contraparte?: string | null;
  descricao?: string | null;
};

export type FinCategoria = { id: string; nome: string; tipo: "despesa" | "receita"; grupo_dre: string; ordem?: number };

export const TIPOS_DOCUMENTO = [
  { key: "boleto", label: "Boleto" },
  { key: "nota_fiscal", label: "Nota fiscal" },
  { key: "recibo", label: "Recibo" },
  { key: "cupom_fiscal", label: "Cupom fiscal" },
  { key: "guia", label: "DARF / guia" },
  { key: "fatura", label: "Fatura" },
  { key: "outro", label: "Outro" },
] as const;

/** Data de hoje (AAAA-MM-DD) no fuso de São Paulo. */
export function hojeSP(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(now);
}

/** "Vencido" é calculado na leitura: aberto com vencimento antes de hoje (São Paulo). */
export function statusVisivel(l: Pick<FinLancamento, "status" | "vencimento">, hoje: string = hojeSP()): FinStatusVisivel {
  if (l.status === "aberto" && l.vencimento && l.vencimento < hoje) return "vencido";
  return l.status;
}

export function formatBRL(v: number | null | undefined): string {
  return Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function formatDataBR(iso?: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-");
  return `${d}/${m}/${y}`;
}

/** Converte "1.850,56", "R$ 1.000,00", "1850.56" em número. */
export function parseValorBR(raw: string | number | null | undefined): number {
  if (typeof raw === "number") return raw;
  let s = String(raw ?? "").replace(/[^\d,.-]/g, "");
  if (!s) return 0;
  if (s.includes(",")) s = s.replace(/\./g, "").replace(",", ".");
  const n = Number(s);
  return Number.isFinite(n) ? n : 0;
}

/** Primeiro dia do mês (AAAA-MM-01) de uma data ISO. */
export function mesDe(iso: string): string {
  return `${iso.slice(0, 7)}-01`;
}

export function mesAnterior(mes: string): string {
  const [y, m] = mes.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

/** Linha do DRE (competência) para receitas marcadas como perda provável na aba Inadimplência. */
export const GRUPO_PERDA = "Perdas com inadimplência (provável)";

export type LinhaDre = { grupo: string; tipo: "receita" | "despesa"; atual: number; anterior: number };

/**
 * DRE por competência: soma dos lançamentos não cancelados, agrupados pelo grupo do DRE da categoria.
 * Receitas positivas, despesas positivas (o resultado é receitas - despesas).
 */
export function calcularDre(
  lancamentos: FinLancamento[],
  categorias: FinCategoria[],
  mes: string,
): { linhas: LinhaDre[]; receitaAtual: number; despesaAtual: number; resultadoAtual: number; resultadoAnterior: number } {
  const ant = mesAnterior(mes);
  const catById = new Map(categorias.map((c) => [c.id, c]));
  const map = new Map<string, LinhaDre>();
  for (const l of lancamentos) {
    if (l.status === "cancelado" || !l.competencia) continue;
    const comp = mesDe(l.competencia);
    if (comp !== mes && comp !== ant) continue;
    const cat = l.categoria_id ? catById.get(l.categoria_id) : undefined;
    const tipo: "receita" | "despesa" = cat?.tipo ?? (l.tipo === "receber" ? "receita" : "despesa");
    const grupo = cat?.grupo_dre ?? (tipo === "receita" ? "Receitas sem categoria" : "Despesas sem categoria");
    const key = `${tipo}|${grupo}`;
    const linha = map.get(key) ?? { grupo, tipo, atual: 0, anterior: 0 };
    if (comp === mes) linha.atual += Number(l.valor || 0);
    else linha.anterior += Number(l.valor || 0);
    map.set(key, linha);
    // Receita marcada como perda provável: a mesma quantia entra como despesa (a receita fica, a perda aparece separada).
    if (tipo === "receita" && (l as any).perda_provavel && l.status !== "pago") {
      const lp = map.get(`despesa|${GRUPO_PERDA}`) ?? { grupo: GRUPO_PERDA, tipo: "despesa" as const, atual: 0, anterior: 0 };
      if (comp === mes) lp.atual += Number(l.valor || 0); else lp.anterior += Number(l.valor || 0);
      map.set(`despesa|${GRUPO_PERDA}`, lp);
    }
  }
  const linhas = [...map.values()].sort((a, b) => (a.tipo === b.tipo ? b.atual - a.atual : a.tipo === "receita" ? -1 : 1));
  const soma = (t: "receita" | "despesa", k: "atual" | "anterior") => linhas.filter((x) => x.tipo === t).reduce((s, x) => s + x[k], 0);
  const receitaAtual = round2(soma("receita", "atual"));
  const despesaAtual = round2(soma("despesa", "atual"));
  return {
    linhas: linhas.map((x) => ({ ...x, atual: round2(x.atual), anterior: round2(x.anterior) })),
    receitaAtual,
    despesaAtual,
    resultadoAtual: round2(receitaAtual - despesaAtual),
    resultadoAnterior: round2(soma("receita", "anterior") - soma("despesa", "anterior")),
  };
}

export type RegimeDre = "competencia" | "caixa";

/** Mês de referência do lançamento no DRE: competência ou data do pagamento (caixa; só pagos). */
export function mesDreDe(l: FinLancamento, regime: RegimeDre): string | null {
  if (l.status === "cancelado") return null;
  if (regime === "caixa") {
    if (l.status !== "pago" || !(l.data_pagamento || l.vencimento)) return null;
    return mesDe((l.data_pagamento || l.vencimento) as string);
  }
  return l.competencia ? mesDe(l.competencia) : null;
}

/**
 * DRE com uma coluna por mês (ex.: os 12 meses do ano), no regime escolhido.
 * Linhas por grupo do DRE; receitas primeiro; total de receitas, despesas e resultado por mês.
 */
export function calcularDreMensal(lancamentos: FinLancamento[], categorias: FinCategoria[], meses: string[], regime: RegimeDre = "competencia") {
  const catById = new Map(categorias.map((c) => [c.id, c]));
  const pos = new Map(meses.map((m, i) => [m, i]));
  const linhas = new Map<string, { grupo: string; tipo: "receita" | "despesa"; valores: number[]; total: number }>();
  for (const l of lancamentos) {
    const m = mesDreDe(l, regime);
    if (!m || !pos.has(m)) continue;
    const cat = l.categoria_id ? catById.get(l.categoria_id) : undefined;
    const tipo: "receita" | "despesa" = cat?.tipo ?? (l.tipo === "receber" ? "receita" : "despesa");
    const grupo = cat?.grupo_dre ?? (tipo === "receita" ? "Receitas sem categoria" : "Despesas sem categoria");
    const key = `${tipo}|${grupo}`;
    const linha = linhas.get(key) ?? { grupo, tipo, valores: meses.map(() => 0), total: 0 };
    const v = Number((regime === "caixa" ? l.valor_pago ?? l.valor : l.valor) || 0);
    linha.valores[pos.get(m)!] += v;
    linha.total += v;
    linhas.set(key, linha);
    if (regime === "competencia" && tipo === "receita" && (l as any).perda_provavel && l.status !== "pago") {
      const kp = `despesa|${GRUPO_PERDA}`;
      const lp = linhas.get(kp) ?? { grupo: GRUPO_PERDA, tipo: "despesa" as const, valores: meses.map(() => 0), total: 0 };
      lp.valores[pos.get(m)!] += v;
      lp.total += v;
      linhas.set(kp, lp);
    }
  }
  const arr = [...linhas.values()]
    .map((x) => ({ ...x, valores: x.valores.map(round2), total: round2(x.total) }))
    .sort((a, b) => (a.tipo === b.tipo ? b.total - a.total : a.tipo === "receita" ? -1 : 1));
  const somaMes = (t: "receita" | "despesa") => meses.map((_, i) => round2(arr.filter((x) => x.tipo === t).reduce((s, x) => s + x.valores[i], 0)));
  const receitas = somaMes("receita");
  const despesas = somaMes("despesa");
  const resultado = meses.map((_, i) => round2(receitas[i] - despesas[i]));
  return { meses, linhas: arr, receitas, despesas, resultado };
}

export function mesesDoAno(ano: number): string[] {
  return Array.from({ length: 12 }, (_, i) => `${ano}-${String(i + 1).padStart(2, "0")}-01`);
}

export type PontoFluxo = { periodo: string; entradas: number; saidas: number; saldo: number };

/**
 * Fluxo de caixa: pagos entram na data de pagamento; abertos entram no vencimento (projetado).
 * Agrupa por dia, semana (segunda-feira) ou mês, com saldo acumulado a partir do saldo inicial.
 */
export function fluxoDeCaixa(
  lancamentos: FinLancamento[],
  agrupamento: "dia" | "semana" | "mes",
  saldoInicial = 0,
  de?: string,
  ate?: string,
): PontoFluxo[] {
  const buckets = new Map<string, { entradas: number; saidas: number }>();
  for (const l of lancamentos) {
    if (l.status === "cancelado") continue;
    const data = l.status === "pago" ? l.data_pagamento || l.vencimento : l.vencimento;
    if (!data) continue;
    if (de && data < de) continue;
    if (ate && data > ate) continue;
    const periodo = chavePeriodo(data, agrupamento);
    const b = buckets.get(periodo) ?? { entradas: 0, saidas: 0 };
    const v = Number((l.status === "pago" ? l.valor_pago ?? l.valor : l.valor) || 0);
    if (l.tipo === "receber") b.entradas += v;
    else b.saidas += v;
    buckets.set(periodo, b);
  }
  let saldo = saldoInicial;
  return [...buckets.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodo, b]) => {
      saldo += b.entradas - b.saidas;
      return { periodo, entradas: round2(b.entradas), saidas: round2(b.saidas), saldo: round2(saldo) };
    });
}

export function chavePeriodo(iso: string, agrupamento: "dia" | "semana" | "mes"): string {
  const d = iso.slice(0, 10);
  if (agrupamento === "dia") return d;
  if (agrupamento === "mes") return d.slice(0, 7);
  const [y, m, day] = d.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  const dow = (dt.getUTCDay() + 6) % 7; // segunda = 0
  dt.setUTCDate(dt.getUTCDate() - dow);
  return dt.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Extrato bancário (OFX / CSV) e conciliação
// ---------------------------------------------------------------------------

export type ItemExtrato = { data: string; valor: number; descricao: string; documento?: string; fit_id?: string };

/** Lê transações de um arquivo OFX (STMTTRN). Valores negativos = saídas. */
export function parseOfx(texto: string): ItemExtrato[] {
  const out: ItemExtrato[] = [];
  const blocos = texto.split(/<STMTTRN>/i).slice(1);
  const tag = (b: string, t: string) => {
    const m = b.match(new RegExp(`<${t}>([^<\\r\\n]*)`, "i"));
    return m ? m[1].trim() : "";
  };
  for (const b of blocos) {
    const dt = tag(b, "DTPOSTED");
    if (dt.length < 8) continue;
    const data = `${dt.slice(0, 4)}-${dt.slice(4, 6)}-${dt.slice(6, 8)}`;
    const valor = Number(tag(b, "TRNAMT").replace(",", "."));
    if (!Number.isFinite(valor)) continue;
    out.push({
      data,
      valor: round2(valor),
      descricao: tag(b, "MEMO") || tag(b, "NAME"),
      documento: tag(b, "CHECKNUM") || tag(b, "REFNUM") || undefined,
      fit_id: tag(b, "FITID") || undefined,
    });
  }
  return out;
}

/**
 * Lê um CSV de extrato (Itaú, Bradesco, Inter e genéricos), separador ; ou ,.
 * - Pula linhas de cabeçalho do banco antes da linha de colunas (Bradesco/Inter).
 * - Aceita uma coluna "Valor" (com sinal) ou colunas separadas "Crédito"/"Débito" (Bradesco).
 * - Ignora linhas de saldo ("SALDO ANTERIOR", "SALDO DO DIA", "Total").
 * Datas DD/MM/AAAA ou AAAA-MM-DD e valores no formato brasileiro.
 */
export function parseCsvExtrato(texto: string): ItemExtrato[] {
  const linhas = texto.replace(/^\uFEFF/, "").split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const contar = (l: string, c: string) => (l.match(new RegExp(`\\${c}`, "g"))?.length ?? 0);
  const amostra = linhas.slice(0, 15).join("\n");
  const sep = contar(amostra, ";") >= contar(amostra, ",") ? ";" : ",";
  const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));

  // Acha a linha de colunas: a primeira que tem "data" e ("valor" ou "crédito"/"débito").
  let hIdx = linhas.findIndex((l) => {
    const t = l.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    return /data/.test(t) && (/valor|amount/.test(t) || /credito|debito/.test(t));
  });
  const norm = (c: string) => c.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  let iData = 0, iDesc = 1, iValor = 2, iCred = -1, iDeb = -1;
  if (hIdx >= 0) {
    const cab = split(linhas[hIdx]).map(norm);
    const idx = (re: RegExp) => cab.findIndex((c) => re.test(c));
    iData = idx(/^data|date/);
    iDesc = idx(/hist|desc|memo|lancamento|detalh/);
    iCred = idx(/^credito|credit/);
    iDeb = idx(/^debito|debit/);
    iValor = idx(/^valor|amount|quantia/);
    if (iDesc < 0) iDesc = iData === 0 ? 1 : 0;
  } else {
    hIdx = -1;
  }
  const out: ItemExtrato[] = [];
  for (const l of linhas.slice(hIdx + 1)) {
    const cols = split(l);
    const data = normalizarData(cols[iData] ?? "");
    if (!data) continue;
    const descricao = cols[iDesc] ?? "";
    if (/^saldo|saldo (anterior|do dia|final)|^total/i.test(descricao.trim())) continue;
    let valor = 0;
    if (iCred >= 0 || iDeb >= 0) {
      const cr = iCred >= 0 ? Math.abs(parseValorBR(cols[iCred] ?? "")) : 0;
      const db = iDeb >= 0 ? Math.abs(parseValorBR(cols[iDeb] ?? "")) : 0;
      valor = cr - db;
    }
    if (!valor && iValor >= 0) valor = parseValorBR(cols[iValor] ?? "");
    if (!valor) continue;
    out.push({ data, valor: round2(valor), descricao });
  }
  return out;
}

export function normalizarData(s: string): string | null {
  const t = s.trim();
  let m = t.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  m = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  return null;
}

/** Diferença em dias entre duas datas ISO. */
export function diasEntre(a: string, b: string): number {
  return Math.round(Math.abs(Date.parse(`${a.slice(0, 10)}T00:00:00Z`) - Date.parse(`${b.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}

const palavras = (s: string) =>
  String(s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4);

/**
 * Sugere o lançamento para um item do extrato: mesmo valor (até 1 centavo), mesmo sentido
 * (saída = pagar, entrada = receber), data até 5 dias de distância; desempata pelo nome.
 * Retorna null se nenhum candidato servir.
 */
export function sugerirConciliacao(
  item: ItemExtrato,
  candidatos: (FinLancamento & { ja_conciliado?: boolean })[],
  janelaDias = 5,
): { lancamentoId: string; pontos: number } | null {
  const tipo: FinTipo = item.valor < 0 ? "pagar" : "receber";
  const alvo = Math.abs(item.valor);
  const pDesc = new Set(palavras(item.descricao));
  let melhor: { lancamentoId: string; pontos: number } | null = null;
  for (const l of candidatos) {
    if (l.ja_conciliado || l.status === "cancelado" || l.tipo !== tipo) continue;
    const valor = Number((l.status === "pago" ? l.valor_pago ?? l.valor : l.valor) || 0);
    if (Math.abs(valor - alvo) > 0.01) continue;
    const ref = l.data_pagamento || l.vencimento;
    if (!ref) continue;
    const dias = diasEntre(ref, item.data);
    if (dias > janelaDias) continue;
    const nome = palavras(`${l.contraparte ?? ""} ${l.descricao ?? ""}`).filter((w) => pDesc.has(w)).length;
    const pontos = 100 - dias * 10 + nome * 15;
    if (!melhor || pontos > melhor.pontos) melhor = { lancamentoId: l.id, pontos };
  }
  return melhor;
}

// ---------------------------------------------------------------------------
// Arquivos do Drive: nome no padrão FORNECEDOR_..._tipo_DDMM.ext
// ---------------------------------------------------------------------------

/** Dicas tiradas do nome do arquivo (ex.: "SYSTEMSAT_boleto_3011.pdf", "DARF_INSS_OR_boleto_1911.pdf"). */
export function dicasDoNomeArquivo(nome: string): { empresa?: string; tipoDocumento?: string; contraparte?: string } {
  const base = nome.replace(/\.[a-z0-9]+$/i, "");
  const partes = base.split(/[_\s-]+/).filter(Boolean);
  const up = partes.map((p) => p.toUpperCase());
  const empresa = up.find((p) => p === "OR" || p === "OT");
  const low = base.toLowerCase();
  const tipoDocumento = /boleto/.test(low)
    ? "boleto"
    : /\bnf\b|nota/.test(low.replace(/_/g, " "))
      ? "nota_fiscal"
      : /recibo/.test(low)
        ? "recibo"
        : /cupom/.test(low)
          ? "cupom_fiscal"
          : /darf|guia|gps|das\b/.test(low)
            ? "guia"
            : /fatura|cobran/.test(low)
              ? "fatura"
              : undefined;
  const contraparte = partes[0] && !/^(darf|nf|boleto)$/i.test(partes[0]) ? partes[0].toUpperCase() : undefined;
  return { empresa, tipoDocumento, contraparte };
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Resumo IA (Relatórios): reconhecer perguntas financeiras
// ---------------------------------------------------------------------------

const RE_FINANCEIRO = new RegExp(
  [
    "\\bdre\\b", "financeir", "inadimpl", "devedor", "em atraso", "atrasad", "fatur", "receita", "despesa", "lucro", "prejuiz",
    "resultado (do|da|financ)", "fluxo de caixa", "\\bcaixa\\b", "contas? a (pagar|receber)", "a pagar", "a receber", "pagament",
    "recebiment", "boleto", "gasto", "custo", "margem", "concilia", "extrato", "fornecedor", "vencid", "mensalidade", "cobran",
  ].join("|"),
  "i",
);

/** A pergunta do Resumo IA é sobre o financeiro? (DRE, inadimplência, contas, fluxo de caixa...) */
export function ehPerguntaFinanceira(texto: string): boolean {
  const t = String(texto || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  return RE_FINANCEIRO.test(t);
}

export type Inadimplente = { cliente: string; documento: string | null; qtd: number; valor: number; maisAntigo: string; diasAtraso: number };

/** Clientes com contas a receber vencidas e não pagas, do maior valor para o menor. */
export function listarInadimplentes(lancamentos: (FinLancamento & { documento_contraparte?: string | null })[], hoje: string = hojeSP()): Inadimplente[] {
  const m = new Map<string, Inadimplente>();
  for (const l of lancamentos) {
    if (l.tipo !== "receber" || statusVisivel(l, hoje) !== "vencido" || !l.vencimento) continue;
    const cliente = (l.contraparte || "Cliente sem nome").trim();
    const key = (l.documento_contraparte || cliente).replace(/\D/g, "") || cliente.toLowerCase();
    const cur = m.get(key) ?? { cliente, documento: l.documento_contraparte ?? null, qtd: 0, valor: 0, maisAntigo: l.vencimento, diasAtraso: 0 };
    cur.qtd += 1;
    cur.valor = round2(cur.valor + Number(l.valor || 0));
    if (l.vencimento < cur.maisAntigo) cur.maisAntigo = l.vencimento;
    cur.diasAtraso = diasEntre(cur.maisAntigo, hoje);
    m.set(key, cur);
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor);
}
