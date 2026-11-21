/**
 * Regras puras da importação de faturas do GSystem para o Financeiro (contas a receber).
 * A API devolve as faturas por cliente (GET /faturas/{cpfCnpj}) e os nomes dos campos variam,
 * então aqui só ficam as conversões, testadas em finance-gsystem.test.ts.
 */
import { normalizarData, parseValorBR, round2 } from "./finance";

export type StatusFatura = "aberto" | "pago" | "cancelado";

export type FaturaGsystem = {
  /** Chave única no Financeiro (coluna gsystem_fatura_key). */
  chave: string;
  numero: string | null;
  valor: number;
  vencimento: string | null;
  emissao: string | null;
  status: StatusFatura;
  dataPagamento: string | null;
  valorPago: number | null;
  descricao: string | null;
  linhaDigitavel: string | null;
  link: string | null;
  categoria: "Receita de mensalidades" | "Receita de instalação e serviços";
};

export type ClienteGsystem = { key: string | null; documento: string; nome: string };

const primeiro = (obj: any, campos: string[]): any => {
  for (const c of campos) {
    const v = obj?.[c];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
};
const texto = (v: any): string | null => (v == null ? null : String(v).trim() || null);
const data = (v: any): string | null => (v == null ? null : normalizarData(String(v)));

/** Tira a lista de faturas da resposta (array puro ou dentro de Items/Data/...). */
export function listaDeFaturas(resp: any): any[] {
  if (Array.isArray(resp)) return resp;
  for (const k of ["Items", "items", "Faturas", "faturas", "Data", "data", "Dados", "dados", "Resultado", "resultado"]) {
    if (Array.isArray(resp?.[k])) return resp[k];
  }
  return [];
}

/** Dados do cliente do GSystem que importam para o Financeiro. */
export function clienteDoGsystem(c: any): ClienteGsystem | null {
  const doc = String(primeiro(c, ["CNPJ", "CPF", "CpfCnpj", "cpfCnpj", "cnpj", "cpf", "Documento", "documento"]) ?? "").replace(/\D/g, "");
  if (doc.length !== 11 && doc.length !== 14) return null;
  return {
    key: texto(primeiro(c, ["Key", "key", "Id", "id", "Codigo", "codigo"])),
    documento: doc,
    nome: texto(primeiro(c, ["Nome", "nome", "RazaoSocial", "razaoSocial", "NomeFantasia", "nomeFantasia", "DisplayName"])) ?? doc,
  };
}

/** Formata CPF/CNPJ só com números para 000.000.000-00 / 00.000.000/0000-00. */
export function formatarDocumento(doc: string): string {
  const d = doc.replace(/\D/g, "");
  if (d.length === 14) return d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, "$1.$2.$3/$4-$5");
  if (d.length === 11) return d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, "$1.$2.$3-$4");
  return doc;
}

/** Situação da fatura: cancelada, paga (status ou data de pagamento) ou em aberto. */
export function statusDaFatura(f: any): StatusFatura {
  const s = String(primeiro(f, ["SituacaoDescricao", "Situacao", "Status", "status", "situacao", "Estado"]) ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  if (/cancel|estorn|exclu/.test(s)) return "cancelado";
  if (/pag|quitad|liquidad|baixad|recebid/.test(s) && !/nao pag|em aberto|a pagar/.test(s)) return "pago";
  if (data(primeiro(f, ["DataPagamento", "dataPagamento", "DataBaixa", "dataBaixa", "DataLiquidacao", "dataLiquidacao", "DataRecebimento"]))) return "pago";
  return "aberto";
}

/** Serviço/instalação quando a descrição indicar; senão mensalidade. */
export function categoriaDaFatura(descricao: string | null): FaturaGsystem["categoria"] {
  const d = (descricao ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  return /instala|servic|visita|manutenc|retirada|reinstala|troca de equip/.test(d)
    ? "Receita de instalação e serviços"
    : "Receita de mensalidades";
}

/**
 * Converte uma fatura do GSystem. Devolve null se não houver valor.
 * A chave usa o identificador da fatura; sem ele, usa cliente + número/vencimento + valor.
 */
export function converterFatura(f: any, cliente: ClienteGsystem): FaturaGsystem | null {
  const valor = round2(Math.abs(parseValorBR(primeiro(f, ["Valor", "valor", "ValorTotal", "valorTotal", "ValorOriginal", "valorOriginal", "ValorDocumento"]))));
  if (!valor) return null;
  const id = texto(primeiro(f, ["Key", "key", "Id", "id", "Codigo", "codigo", "IdFatura", "CodigoFatura"]));
  const numero = texto(primeiro(f, ["NumeroDocumento", "numeroDocumento", "Numero", "numero", "NossoNumero", "nossoNumero", "Documento"]));
  const vencimento = data(primeiro(f, ["DataVencimento", "dataVencimento", "Vencimento", "vencimento"]));
  const status = statusDaFatura(f);
  const descricao = texto(primeiro(f, ["Descricao", "descricao", "Historico", "historico", "Referencia", "referencia", "Observacao"]));
  const valorPagoRaw = primeiro(f, ["ValorPago", "valorPago", "ValorRecebido", "valorRecebido", "ValorBaixa", "ValorLiquidado"]);
  const dataPagamento = status === "pago"
    ? data(primeiro(f, ["DataPagamento", "dataPagamento", "DataBaixa", "dataBaixa", "DataLiquidacao", "dataLiquidacao", "DataRecebimento"])) ?? vencimento
    : null;
  const chave = id
    ? `gs:${id}`
    : `gs:${cliente.documento}:${numero ?? vencimento ?? "sem-data"}:${valor.toFixed(2)}`;
  return {
    chave,
    numero: numero ?? id,
    valor,
    vencimento,
    emissao: data(primeiro(f, ["DataEmissao", "dataEmissao", "Emissao", "emissao", "DataCriacao", "DataCadastro"])),
    status,
    dataPagamento,
    valorPago: status === "pago" ? round2(valorPagoRaw != null ? Math.abs(parseValorBR(valorPagoRaw)) : valor) : null,
    descricao,
    linhaDigitavel: texto(primeiro(f, ["LinhaDigitavel", "linhaDigitavel", "CodigoBarras", "codigoBarras"])),
    link: texto(primeiro(f, ["LinkBoleto", "linkBoleto", "UrlBoleto", "urlBoleto", "Url", "url", "Link", "link"])),
    categoria: categoriaDaFatura(descricao),
  };
}

/** Quantos meses de histórico (pagas/canceladas) entram no Financeiro; em aberto entram sempre. */
export const MESES_HISTORICO = 12;

/**
 * Faturas em aberto entram sempre (inadimplência). Pagas e canceladas só a partir do 1º dia
 * do mês de MESES_HISTORICO meses atrás, para não lotar o Financeiro com anos de histórico.
 */
export function deveImportar(f: Pick<FaturaGsystem, "status" | "vencimento" | "dataPagamento">, hoje: string): boolean {
  if (f.status === "aberto") return true;
  const [y, m] = hoje.split("-").map(Number);
  const total = y * 12 + (m - 1) - MESES_HISTORICO;
  const corte = `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}-01`;
  const ref = f.vencimento ?? f.dataPagamento;
  return !!ref && ref >= corte;
}

/**
 * O que muda num lançamento que já existe. O GSystem manda em valor, vencimento e situação,
 * mas uma baixa feita no Financeiro (pago/cancelado) não é desfeita por uma fatura ainda aberta lá.
 * Categoria, empresa, conta e observação ficam como o usuário deixou.
 */
export function atualizacaoDeFatura(
  atual: { status: string; valor: number; vencimento: string | null; data_pagamento: string | null; valor_pago: number | null },
  f: FaturaGsystem,
): Record<string, unknown> | null {
  const mud: Record<string, unknown> = {};
  if (round2(Number(atual.valor)) !== f.valor) mud.valor = f.valor;
  if (f.vencimento && atual.vencimento !== f.vencimento) mud.vencimento = f.vencimento;
  if (f.status !== "aberto" && atual.status !== f.status) mud.status = f.status;
  if (f.status === "pago") {
    if (atual.data_pagamento !== f.dataPagamento) mud.data_pagamento = f.dataPagamento;
    if (atual.valor_pago == null || round2(Number(atual.valor_pago)) !== f.valorPago) mud.valor_pago = f.valorPago;
  }
  return Object.keys(mud).length ? mud : null;
}
