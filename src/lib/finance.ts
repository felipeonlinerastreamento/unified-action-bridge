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
 * Lê um CSV de extrato com colunas de data, descrição e valor (separador ; ou ,).
 * Aceita datas DD/MM/AAAA ou AAAA-MM-DD e valores no formato brasileiro.
 */
export function parseCsvExtrato(texto: string): ItemExtrato[] {
  const linhas = texto.split(/\r?\n/).filter((l) => l.trim());
  if (!linhas.length) return [];
  const sep = (linhas[0].match(/;/g)?.length ?? 0) >= (linhas[0].match(/,/g)?.length ?? 0) ? ";" : ",";
  const cab = linhas[0].split(sep).map((c) => c.trim().toLowerCase());
  const idx = (re: RegExp) => cab.findIndex((c) => re.test(c));
  let iData = idx(/data|date/);
  let iDesc = idx(/hist|desc|memo|lan/);
  let iValor = idx(/valor|amount|quantia/);
  const temCabecalho = iData >= 0 || iValor >= 0;
  if (!temCabecalho) { iData = 0; iDesc = 1; iValor = 2; }
  const out: ItemExtrato[] = [];
  for (const l of linhas.slice(temCabecalho ? 1 : 0)) {
    const cols = l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
    const data = normalizarData(cols[iData] ?? "");
    if (!data) continue;
    const valor = parseValorBR(cols[iValor] ?? "");
    if (!valor) continue;
    out.push({ data, valor: round2(valor), descricao: cols[iDesc] ?? "" });
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
