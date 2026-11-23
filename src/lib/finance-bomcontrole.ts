/**
 * Regras puras da importação do Bom Controle para o Financeiro.
 * A API (GET /integracao/Financeiro/Pesquisar) devolve uma linha por parcela, com campos planos.
 * Aqui ficam a conversão para lançamento, a regra que evita duplicar recebíveis do GSystem,
 * as janelas de busca e o resumo por mês. Testes em finance-bomcontrole.test.ts.
 */
import { normalizarData, round2 } from "./finance";

export type ParcelaBomControle = Record<string, any>;

export type LancamentoBomControle = {
  parcelaId: number;
  tipo: "pagar" | "receber";
  contraparte: string | null;
  documento: string | null; // só números
  descricao: string | null;
  valor: number;
  vencimento: string | null;
  competencia: string | null;
  dataEmissao: string | null;
  dataPagamento: string | null;
  valorPago: number | null;
  status: "aberto" | "pago";
  formaPagamento: string | null;
  numeroDocumento: string | null;
  categoria: string | null;
  categoriaDespesa: boolean;
  contaBancaria: { nome: string | null; banco: string | null; conta: string | null };
  empresaDocumento: string | null;
  empresaNome: string | null;
  departamento: string | null;
  link: string | null;
  observacao: string | null;
};

const texto = (v: any): string | null => (v == null ? null : String(v).trim() || null);
const data = (v: any): string | null => {
  const t = texto(v);
  if (!t || t.startsWith("0001-01-01")) return null;
  return normalizarData(t);
};
const numero = (v: any): number => {
  const n = typeof v === "number" ? v : Number(String(v ?? "").replace(",", "."));
  return Number.isFinite(n) ? n : 0;
};
export const soDigitos = (v: any): string | null => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length === 11 || d.length === 14 ? d : null;
};
export const semAcento = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** Transferência entre contas não vira lançamento (não é receita nem despesa). */
export function ehTransferencia(p: ParcelaBomControle): boolean {
  return /transfer/.test(semAcento(String(p.NomeTipoMovimentacao ?? p.TipoMovimentacao ?? "")));
}

/** Converte a parcela do Bom Controle; null quando não serve (sem id, valor zero, transferência). */
export function converterParcela(p: ParcelaBomControle): LancamentoBomControle | null {
  const id = Number(p.IdMovimentacaoFinanceiraParcela);
  if (!Number.isFinite(id) || id <= 0) return null;
  if (ehTransferencia(p)) return null;
  const valor = round2(Math.abs(numero(p.Valor))); // ValorDefinitivo é só um indicador (booleano)
  if (!valor) return null;
  const debito = p.Debito === true || String(p.Debito).toLowerCase() === "true";
  const quitacao = data(p.DataQuitacao);
  const nParc = Number(p.QuantidadeParcela) > 1 ? ` (${p.NumeroParcela}/${p.QuantidadeParcela})` : "";
  const competencia = data(p.DataCompetencia);
  const obs = [
    "Importado do Bom Controle",
    texto(p.Observacao),
    texto(p.NomeContaFinanceira) ? `Conta: ${texto(p.NomeContaFinanceira)}` : null,
    texto(p.NomeDepartamento) ? `Centro de custo: ${texto(p.NomeDepartamento)}` : null,
  ].filter(Boolean).join(" · ");
  return {
    parcelaId: id,
    tipo: debito ? "pagar" : "receber",
    contraparte: texto(p.NomeClienteFornecedor) ?? texto(p.NomeFantasiaClienteFornecedor),
    documento: soDigitos(p.DocumentoClienteFornecedor),
    descricao: texto(p.Nome) ? `${texto(p.Nome)}${nParc}` : null,
    valor,
    vencimento: data(p.DataVencimento),
    competencia: competencia ? `${competencia.slice(0, 7)}-01` : null,
    dataEmissao: data(p.DataFaturamento) ?? data(p.DataCriacaoParcela),
    dataPagamento: quitacao,
    valorPago: quitacao ? valor : null,
    status: quitacao ? "pago" : "aberto",
    formaPagamento: texto(p.NomeFormaPagamento),
    numeroDocumento: texto(p.NumeroDocumento),
    categoria: texto(p.NomeCategoriaFinanceira),
    categoriaDespesa: debito,
    contaBancaria: { nome: texto(p.NomeContaFinanceira), banco: texto(p.NomeBanco), conta: texto(p.NumeroConta) },
    empresaDocumento: soDigitos(p.DocumentoEmpresa),
    empresaNome: texto(p.NomeEmpresa),
    departamento: texto(p.NomeDepartamento),
    link: texto(p.LinkBoletoBancario) ?? texto(p.LinkNotaFiscalServico),
    observacao: obs,
  };
}

export type RecebivelGsystem = { documento: string | null; vencimento: string | null; valor: number };

/**
 * Recebível que já veio do GSystem: mesmo CPF/CNPJ e valor (até 1% ou R$ 0,05 de diferença)
 * com vencimento até 5 dias de distância. Só vale para contas a receber.
 */
export function ehDuplicataGsystem(l: LancamentoBomControle, gsystem: RecebivelGsystem[]): boolean {
  if (l.tipo !== "receber" || !l.documento || !l.vencimento) return false;
  const venc = Date.parse(`${l.vencimento}T00:00:00Z`);
  return gsystem.some((g) => {
    if (!g.documento || !g.vencimento || g.documento.replace(/\D/g, "") !== l.documento) return false;
    const dias = Math.abs(Date.parse(`${g.vencimento.slice(0, 10)}T00:00:00Z`) - venc) / 86_400_000;
    const tol = Math.max(0.05, Math.abs(g.valor) * 0.01);
    return dias <= 5 && Math.abs(Math.abs(g.valor) - l.valor) <= tol;
  });
}

/** Janelas mensais de busca: dos 12 meses anteriores ao mês atual até 12 meses à frente (contas em aberto). */
export function janelasImportacao(hoje: string, mesesAtras = 12, mesesFrente = 12): { de: string; ate: string; mes: string }[] {
  const [a, m] = hoje.slice(0, 7).split("-").map(Number);
  const out: { de: string; ate: string; mes: string }[] = [];
  for (let i = -mesesAtras; i <= mesesFrente; i++) {
    const d = new Date(Date.UTC(a, m - 1 + i, 1));
    const fim = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
    const iso = (x: Date) => x.toISOString().slice(0, 10);
    out.push({ de: iso(d), ate: iso(fim), mes: iso(d).slice(0, 7) });
  }
  return out;
}

export type LinhaResumo = {
  mes: string;
  pagarQtd: number; pagarTotal: number;
  receberQtd: number; receberTotal: number;
  ignoradosGsystem: number; jaImportados: number;
};

/** Junta os números de uma página no resumo por mês (de vencimento). */
export function somarResumo(
  resumo: Record<string, LinhaResumo>,
  itens: { l: LancamentoBomControle; situacao: "novo" | "existente" | "gsystem" }[],
  mesPadrao: string,
): Record<string, LinhaResumo> {
  for (const { l, situacao } of itens) {
    const mes = (l.vencimento ?? l.competencia ?? mesPadrao).slice(0, 7);
    const r = (resumo[mes] ??= { mes, pagarQtd: 0, pagarTotal: 0, receberQtd: 0, receberTotal: 0, ignoradosGsystem: 0, jaImportados: 0 });
    if (situacao === "gsystem") { r.ignoradosGsystem++; continue; }
    if (situacao === "existente") r.jaImportados++;
    if (l.tipo === "pagar") { r.pagarQtd++; r.pagarTotal = round2(r.pagarTotal + l.valor); }
    else { r.receberQtd++; r.receberTotal = round2(r.receberTotal + l.valor); }
  }
  return resumo;
}
