/**
 * Regras puras da gestão de protesto e negativação (Serasa, SPC, Boa Vista) do Financeiro.
 * Situação visível de cada registro (inclusive "quitado, dar baixa" com prazo), candidatos a
 * negativar, indicadores e o texto da carta de anuência. Testes em finance-negativacao.test.ts.
 *
 * Prazo de baixa: Súmula 548 do STJ — o credor exclui o registro em 5 dias úteis a partir do
 * pagamento integral. Para protesto, o prazo serve de meta interna para entregar a carta de anuência.
 * Dias úteis aqui contam só segunda a sexta (feriados não são descontados).
 */
import { round2 } from "./finance";
import type { ClienteInadimplente } from "./finance-inadimplencia";

export type Orgao = "serasa" | "spc" | "boa_vista" | "protesto";
export type SituacaoNeg = "preparando" | "enviado" | "ativo" | "baixado" | "cancelado";

export const NOME_ORGAO: Record<Orgao, string> = { serasa: "Serasa", spc: "SPC", boa_vista: "Boa Vista", protesto: "Protesto em cartório" };
export const NOME_SITUACAO: Record<SituacaoNeg, string> = {
  preparando: "Em preparação", enviado: "Enviado", ativo: "Negativado / protestado", baixado: "Baixado", cancelado: "Cancelado",
};

export type Negativacao = {
  id: string;
  documento: string;
  cliente_nome?: string | null;
  orgao: Orgao;
  situacao: SituacaoNeg;
  valor: number;
  lancamento_ids: string[];
  data_envio?: string | null;
  data_inclusao?: string | null;
  protocolo?: string | null;
  cartorio?: string | null;
  cidade_uf?: string | null;
  custo?: number | null;
  data_quitacao?: string | null;
  data_baixa?: string | null;
  anuencia_emitida_em?: string | null;
  observacao?: string | null;
  created_at: string;
};

export type LancNeg = { id: string; status: string; valor: number; vencimento?: string | null; data_pagamento?: string | null };

/** Soma dias úteis (segunda a sexta) a uma data ISO. */
export function somaDiasUteis(iso: string, dias: number): string {
  let t = Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
  let n = 0;
  while (n < dias) {
    t += 86_400_000;
    const d = new Date(t).getUTCDay();
    if (d !== 0 && d !== 6) n++;
  }
  return new Date(t).toISOString().slice(0, 10);
}

const diasEntre = (de: string, ate: string) =>
  Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);

export type SituacaoVisivel = SituacaoNeg | "quitado_baixar" | "baixa_atrasada";

export type AvaliacaoNeg = {
  visivel: SituacaoVisivel;
  quitado: boolean;
  dataQuitacao: string | null;
  prazoBaixa: string | null;
  diasParaPrazo: number | null;   // negativo = atrasado
  valorAberto: number;
  valorPago: number;
};

/**
 * Avalia o registro olhando as faturas incluídas: se todas estão pagas (ou canceladas) — ou a quitação
 * foi informada à mão — e o registro está ativo/enviado, vira "quitado, dar baixa" com prazo.
 */
export function avaliarNegativacao(n: Negativacao, lancs: Map<string, LancNeg>, hoje: string, prazoDiasUteis = 5): AvaliacaoNeg {
  const fats = n.lancamento_ids.map((id) => lancs.get(id)).filter(Boolean) as LancNeg[];
  const abertas = fats.filter((f) => f.status === "aberto");
  const pagas = fats.filter((f) => f.status === "pago");
  const valorAberto = round2(abertas.reduce((s, f) => s + Number(f.valor || 0), 0));
  const valorPago = round2(pagas.reduce((s, f) => s + Number(f.valor || 0), 0));
  const quitadoPelasFaturas = fats.length > 0 && abertas.length === 0 && pagas.length > 0;
  const ultimaPaga = pagas.map((f) => f.data_pagamento ?? "").filter(Boolean).sort().pop() ?? null;
  const dataQuitacao = n.data_quitacao ?? (quitadoPelasFaturas ? ultimaPaga : null);
  const quitado = !!n.data_quitacao || quitadoPelasFaturas;
  const base: AvaliacaoNeg = { visivel: n.situacao, quitado, dataQuitacao, prazoBaixa: null, diasParaPrazo: null, valorAberto, valorPago };
  if (n.situacao === "baixado" || n.situacao === "cancelado" || n.situacao === "preparando") return base;
  if (!quitado) return base;
  const ref = dataQuitacao ?? hoje;
  const prazo = somaDiasUteis(ref, prazoDiasUteis);
  const dias = diasEntre(hoje, prazo);
  return { ...base, visivel: dias < 0 ? "baixa_atrasada" : "quitado_baixar", prazoBaixa: prazo, diasParaPrazo: dias };
}

/** Registros que ainda pesam no nome do cliente (enviados ou ativos). */
export const emVigor = (n: Pick<Negativacao, "situacao">) => n.situacao === "enviado" || n.situacao === "ativo";

/**
 * Candidatos a negativar/protestar: atraso e valor mínimos, sem registro em vigor ou em preparação,
 * sem promessa de pagamento em dia e sem acordo nos últimos 30 dias.
 */
export function candidatosNegativacao(
  lista: ClienteInadimplente[],
  negativacoes: Negativacao[],
  hoje: string,
  criterio: { diasMinimo: number; valorMinimo: number },
): ClienteInadimplente[] {
  const comRegistro = new Set(negativacoes.filter((n) => emVigor(n) || n.situacao === "preparando").map((n) => n.documento));
  return lista.filter((c) =>
    c.documento &&
    !comRegistro.has(c.documento) &&
    c.diasMaisAntigo >= criterio.diasMinimo &&
    c.valor - c.valorPerda >= criterio.valorMinimo &&
    !(c.promessa && !c.promessa.quebrada) &&
    !(c.acordo && diasEntre(c.acordo.created_at.slice(0, 10), hoje) <= 30));
}

export type IndicadoresNeg = {
  emVigor: number;
  valorEmVigor: number;
  porOrgao: Record<Orgao, { qtd: number; valor: number }>;
  baixasPendentes: number;
  baixasAtrasadas: number;
  recuperado: number;            // faturas negativadas/protestadas que já foram pagas
  custos: number;
};

export function indicadoresNegativacao(negs: Negativacao[], lancs: Map<string, LancNeg>, hoje: string, prazoDiasUteis = 5): IndicadoresNeg {
  const porOrgao = { serasa: { qtd: 0, valor: 0 }, spc: { qtd: 0, valor: 0 }, boa_vista: { qtd: 0, valor: 0 }, protesto: { qtd: 0, valor: 0 } } as IndicadoresNeg["porOrgao"];
  let emV = 0, valorEmV = 0, pend = 0, atr = 0, rec = 0, custos = 0;
  for (const n of negs) {
    if (n.situacao === "cancelado") continue;
    const a = avaliarNegativacao(n, lancs, hoje, prazoDiasUteis);
    custos += Number(n.custo || 0);
    rec += a.valorPago;
    if (a.visivel === "quitado_baixar") pend++;
    if (a.visivel === "baixa_atrasada") { pend++; atr++; }
    if (emVigor(n)) {
      emV++;
      const v = a.valorAberto || Number(n.valor || 0);
      valorEmV += a.quitado ? 0 : v;
      porOrgao[n.orgao].qtd++;
      porOrgao[n.orgao].valor = round2(porOrgao[n.orgao].valor + (a.quitado ? 0 : v));
    }
  }
  return { emVigor: emV, valorEmVigor: round2(valorEmV), porOrgao, baixasPendentes: pend, baixasAtrasadas: atr, recuperado: round2(rec), custos: round2(custos) };
}

const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");
const formatarDoc = (d: string) => {
  const x = d.replace(/\D/g, "");
  if (x.length === 14) return x.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (x.length === 11) return x.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return d;
};
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

/** Texto da carta de anuência (para imprimir, assinar e reconhecer firma). */
export function textoCartaAnuencia(d: {
  credor: { nome: string; cnpj: string | null; cidade?: string | null };
  devedor: { nome: string; documento: string };
  neg: Pick<Negativacao, "protocolo" | "cartorio" | "cidade_uf" | "data_inclusao" | "valor">;
  faturas: { vencimento: string | null; valor: number; numero?: string | null }[];
  hoje: string;
}): { titulo: string; paragrafos: string[]; local: string } {
  const titulos = d.faturas.length
    ? d.faturas.map((f) => `${f.numero ? `documento nº ${f.numero}, ` : ""}vencimento em ${f.vencimento ? dataBR(f.vencimento) : "—"}, no valor de ${brl(Number(f.valor))}`).join("; ")
    : `no valor de ${brl(Number(d.neg.valor))}`;
  const [a, m, dd] = d.hoje.split("-");
  return {
    titulo: "CARTA DE ANUÊNCIA",
    paragrafos: [
      `Ao ${d.neg.cartorio?.trim() || "Tabelionato de Protesto de Títulos"}${d.neg.cidade_uf ? ` de ${d.neg.cidade_uf}` : ""}`,
      `${d.credor.nome}${d.credor.cnpj ? `, inscrita no CNPJ sob o nº ${formatarDoc(d.credor.cnpj)}` : ""}, na qualidade de credora, declara para os devidos fins que recebeu de ${d.devedor.nome}, inscrito(a) no ${d.devedor.documento.replace(/\D/g, "").length === 14 ? "CNPJ" : "CPF"} sob o nº ${formatarDoc(d.devedor.documento)}, o pagamento integral do(s) título(s) a seguir: ${titulos}.`,
      `${d.neg.protocolo ? `O(s) título(s) foi(ram) protestado(s) sob o protocolo nº ${d.neg.protocolo}${d.neg.data_inclusao ? `, em ${dataBR(d.neg.data_inclusao)}` : ""}. ` : ""}Por estar a dívida quitada, concede anuência ao cancelamento do respectivo protesto, nada mais tendo a reclamar a esse título.`,
    ],
    local: `${d.credor.cidade ? `${d.credor.cidade}, ` : ""}${Number(dd)} de ${MESES[Number(m) - 1]} de ${a}.`,
  };
}
