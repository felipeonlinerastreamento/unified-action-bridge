/**
 * Regras automáticas de Contratos (Configurações › Contratos). Puras e testadas em contratos-automacao.test.ts:
 * lembrete de assinatura pendente, aviso de vencimento, rascunho a partir da proposta aceita,
 * conferência com o Financeiro e reajuste anual pelo índice.
 */
import { fimVigencia, somaMeses, soDigitos, type DadosContrato } from "@/lib/contratos";

export type ModoEnvio = "autentique" | "whatsapp" | "email" | "whatsapp_email";
export type Indice = "IPCA" | "IGPM" | "INPC" | "FIXO";

export type ConfigContratos = {
  lembrete_ativo: boolean;
  lembrete_dias: number[];
  lembrete_modo: ModoEnvio;
  lembrete_avisar_responsavel: boolean;
  vencimento_ativo: boolean;
  vencimento_dias: number[];
  vencimento_avisar_responsavel: boolean;
  vencimento_avisar_usuarios: string[];
  vencimento_fornecedores: boolean;
  proposta_cria_rascunho: boolean;
  financeiro_tolerancia_pct: number;
  reajuste_ativo: boolean;
  reajuste_indice: Indice;
  reajuste_fixo_pct: number;
  reajuste_aviso_dias: number;
  reajuste_mensagem: string;
  indices: Partial<Record<Indice, { pct: number; ate: string; atualizado_em: string }>>;
  /** Setores avisados (todos os usuários ativos de cada setor). */
  lembrete_avisar_setores: string[];
  vencimento_avisar_setores: string[];
  reajuste_avisar_setores: string[];
  proposta_avisar_setores: string[];
};

export const CONFIG_PADRAO: ConfigContratos = {
  lembrete_ativo: true, lembrete_dias: [3, 7], lembrete_modo: "whatsapp", lembrete_avisar_responsavel: true,
  vencimento_ativo: true, vencimento_dias: [60, 30], vencimento_avisar_responsavel: true, vencimento_avisar_usuarios: [], vencimento_fornecedores: true,
  proposta_cria_rascunho: true, financeiro_tolerancia_pct: 5,
  reajuste_ativo: true, reajuste_indice: "IPCA", reajuste_fixo_pct: 0, reajuste_aviso_dias: 30,
  reajuste_mensagem: "Olá, {contato}! Conforme o contrato nº {numero}, a mensalidade de {cliente} será reajustada em {percentual} ({indice} acumulado em 12 meses) a partir de {data}: de {valor_atual} para {valor_novo}. Qualquer dúvida, estamos à disposição.",
  indices: {},
  lembrete_avisar_setores: [], vencimento_avisar_setores: [], reajuste_avisar_setores: [], proposta_avisar_setores: [],
};

export const INDICE_LABEL: Record<Indice, string> = { IPCA: "IPCA", IGPM: "IGP-M", INPC: "INPC", FIXO: "Percentual fixo" };
/** Séries mensais (% ao mês) do Banco Central (SGS). */
export const SERIE_BCB: Record<Exclude<Indice, "FIXO">, number> = { IPCA: 433, IGPM: 189, INPC: 188 };

const DIA = 86_400_000;
export const diasEntre = (a: string, b: string) => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / DIA);
const r2 = (n: number) => Math.round(n * 100) / 100;

/** Lista de dias digitada ("3, 7, 15") → números positivos, sem repetir, em ordem. */
export function lerListaDias(txt: string, max = 365): number[] {
  return [...new Set(String(txt).split(/[^\d]+/).map(Number).filter((n) => Number.isInteger(n) && n > 0 && n <= max))].sort((a, b) => a - b);
}

// ------------------------------------------------------------------ lembrete de assinatura
type ContratoLembrete = { id: string; status: string; enviado_em: string | null; lembretes_enviados?: number | null };

/** Contratos enviados há X dias sem assinatura que ainda não receberam o lembrete daquele dia. */
export function lembretesDevidos<T extends ContratoLembrete>(contratos: T[], dias: number[], hoje: string): { contrato: T; etapa: number; diasDesdeEnvio: number }[] {
  const etapas = [...new Set(dias)].filter((d) => d > 0).sort((a, b) => a - b);
  const out: { contrato: T; etapa: number; diasDesdeEnvio: number }[] = [];
  for (const c of contratos) {
    if (c.status !== "enviado" || !c.enviado_em) continue;
    const feitos = c.lembretes_enviados ?? 0;
    if (feitos >= etapas.length) continue;
    const desde = diasEntre(c.enviado_em, hoje);
    if (desde >= etapas[feitos]) out.push({ contrato: c, etapa: feitos + 1, diasDesdeEnvio: desde });
  }
  return out;
}

// ------------------------------------------------------------------ vencimento
type ContratoVigencia = {
  id: string; status: string; vigencia_inicio: string | null; vigencia_meses: number | null; renovacao_automatica: boolean | null;
  categoria?: string | null; avisos_enviados?: Record<string, unknown> | null;
};

/**
 * Avisos de fim de vigência: um por limite (ex.: 60 e 30 dias antes) e por período.
 * Se o sistema ligar já dentro de dois limites, manda um só (o mais próximo) e marca os dois.
 */
export function avisosVencimento<T extends ContratoVigencia>(contratos: T[], dias: number[], hoje: string, incluirFornecedores = true) {
  const limites = [...new Set(dias)].filter((d) => d > 0).sort((a, b) => b - a);
  const out: { contrato: T; fim: string; diasAteFim: number; chaves: string[] }[] = [];
  for (const c of contratos) {
    if (c.status !== "assinado" || !c.vigencia_inicio) continue;
    if (!incluirFornecedores && c.categoria === "fornecedor") continue;
    const fim = fimVigencia(c.vigencia_inicio, c.vigencia_meses || 12, c.renovacao_automatica !== false, hoje);
    const faltam = diasEntre(hoje, fim);
    if (faltam < 0) continue;
    const ja = c.avisos_enviados || {};
    const chaves = limites.filter((d) => faltam <= d).map((d) => `venc:${fim}:${d}`).filter((k) => !(k in ja));
    if (chaves.length) out.push({ contrato: c, fim, diasAteFim: faltam, chaves });
  }
  return out;
}

// ------------------------------------------------------------------ proposta aceita → rascunho
type Snapshot = {
  title?: string | null;
  client?: { companyName?: string | null; contactName?: string | null; phone?: string | null; email?: string | null; cnpj?: string | null } | null;
  items?: { name?: string | null; description?: string | null; quantity?: number | null; activationValue?: number | null; monthlyValue?: number | null }[] | null;
  totals?: { activation?: number | null; monthly?: number | null } | null;
};

export const brlTexto = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Campos do rascunho do contrato a partir da proposta aceita no CRM. */
export function rascunhoDaProposta(snap: Snapshot, hoje: string) {
  const cli = snap.client || {};
  const doc = soDigitos(cli.cnpj);
  const nome = (cli.companyName || cli.contactName || snap.title || "Cliente").trim();
  const mensal = Number(snap.totals?.monthly) || 0;
  const ativacao = Number(snap.totals?.activation) || 0;
  const itens = (snap.items || []).filter((i) => (i.name || i.description) && (Number(i.quantity) || 0) > 0)
    .map((i) => `${i.quantity}× ${(i.name || i.description || "").trim()}`);
  const dados: Partial<DadosContrato> = {
    tipo_pessoa: doc.length === 11 ? "PF" : "PJ",
    cliente_nome: nome,
    cliente_documento: doc,
    vigencia_meses: 12,
    vigencia_inicio: hoje,
    veiculos: [],
    planos: ["frotas"],
    instalacao: "credenciado",
    ...(mensal ? { valor_mensalidade: brlTexto(mensal) } : {}),
    ...(ativacao ? { valor_implantacao: brlTexto(ativacao) } : {}),
    ...(itens.length ? { remuneracao: `Conforme proposta aceita: ${itens.join("; ")}.` } : {}),
  };
  return {
    cliente_nome: nome, cliente_documento: doc, dados,
    valor_mensal: mensal || null, valor_implantacao: ativacao || null,
    signatario_nome: cli.contactName || null, signatario_email: cli.email || null, signatario_telefone: cli.phone || null,
    vigencia_inicio: hoje, vigencia_meses: 12,
  };
}

// ------------------------------------------------------------------ financeiro
export type ConferenciaFinanceiro = { status: "ok" | "abaixo" | "acima" | "sem_dados"; contrato: number | null; realizado: number | null; diferenca: number | null; pct: number | null };

/** Compara o valor mensal do contrato com o realizado (média das faturas ou pagamentos). */
export function conferirValor(contrato: number | null | undefined, realizado: number | null | undefined, toleranciaPct: number): ConferenciaFinanceiro {
  const c = Number(contrato) || 0;
  const r = realizado == null ? null : Number(realizado) || 0;
  if (!c || r == null) return { status: "sem_dados", contrato: c || null, realizado: r, diferenca: null, pct: null };
  const dif = r2(r - c);
  const pct = r2((dif / c) * 100);
  const status = Math.abs(pct) <= toleranciaPct ? "ok" : dif < 0 ? "abaixo" : "acima";
  return { status, contrato: c, realizado: r, diferenca: dif, pct };
}

/** Valor mensal vigente: o reajustado, senão o do contrato, senão o digitado no rascunho ("1.234,56"). */
export function valorMensalVigente(c: { valor_mensal_atual?: number | null; valor_mensal?: number | null; dados?: Partial<DadosContrato> | null }): number | null {
  const v = Number(c.valor_mensal_atual) || Number(c.valor_mensal) || 0;
  if (v) return v;
  const txt = String(c.dados?.valor_mensalidade ?? "").replace(/[^\d,.-]/g, "").replace(/\./g, "").replace(",", ".");
  const n = Number(txt);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ------------------------------------------------------------------ reajuste
/** Variação acumulada (%) dos últimos 12 meses de uma série mensal [{ data: "dd/mm/aaaa", valor: "0,44" }]. */
export function acumulado12(serie: { data: string; valor: string | number }[]): { pct: number; ate: string } | null {
  const pontos = serie
    .map((p) => {
      const [d, m, a] = String(p.data).split("/");
      return { ym: `${a}-${m}`, v: Number(String(p.valor).replace(",", ".")), d: `${a}-${m}-${d}` };
    })
    .filter((p) => Number.isFinite(p.v) && p.ym.length === 7)
    .sort((a, b) => a.ym.localeCompare(b.ym));
  if (pontos.length < 12) return null;
  const ult = pontos.slice(-12);
  const fator = ult.reduce((f, p) => f * (1 + p.v / 100), 1);
  return { pct: Math.round((fator - 1) * 10000) / 100, ate: ult[ult.length - 1].ym };
}

export function percentualReajuste(cfg: Pick<ConfigContratos, "reajuste_indice" | "reajuste_fixo_pct" | "indices">): number | null {
  if (cfg.reajuste_indice === "FIXO") return Number(cfg.reajuste_fixo_pct) || 0;
  const i = cfg.indices?.[cfg.reajuste_indice];
  return i ? i.pct : null;
}

type ContratoReajuste = ContratoVigencia & {
  valor_mensal_atual?: number | null; valor_mensal?: number | null; dados?: Partial<DadosContrato> | null;
  reajustes?: { data: string }[] | null;
};

/** Próximo aniversário (a cada 12 meses do início) que ainda não passou. */
export function proximoAniversario(inicio: string, hoje: string): string {
  let n = 1;
  let d = somaMeses(inicio, 12);
  while (d < hoje && n < 100) { n++; d = somaMeses(inicio, 12 * n); }
  return d;
}

/**
 * Reajustes a fazer: contratos assinados cujo aniversário está dentro do aviso (ou já passou há até 60 dias)
 * e que ainda não foram reajustados naquela data.
 */
export function reajustesPendentes<T extends ContratoReajuste>(contratos: T[], hoje: string, avisoDias: number, pct: number | null) {
  const out: { contrato: T; data: string; diasAte: number; valorAtual: number | null; valorNovo: number | null; pct: number | null }[] = [];
  for (const c of contratos) {
    if (c.status !== "assinado" || !c.vigencia_inicio) continue;
    const feitos = new Set((c.reajustes || []).map((r) => r.data));
    // Aniversário recente ainda não reajustado (até 60 dias atrás) ou o próximo dentro do aviso.
    let data = proximoAniversario(c.vigencia_inicio, hoje);
    const anterior = (() => { let n = 1, d = somaMeses(c.vigencia_inicio!, 12), ult: string | null = null; while (d < hoje && n < 100) { ult = d; n++; d = somaMeses(c.vigencia_inicio!, 12 * n); } return ult; })();
    if (anterior && !feitos.has(anterior) && diasEntre(anterior, hoje) <= 60) data = anterior;
    if (feitos.has(data)) continue;
    const diasAte = diasEntre(hoje, data);
    if (diasAte > avisoDias) continue;
    const atual = valorMensalVigente(c);
    out.push({ contrato: c, data, diasAte, valorAtual: atual, valorNovo: atual != null && pct != null ? r2(atual * (1 + pct / 100)) : null, pct });
  }
  return out.sort((a, b) => a.data.localeCompare(b.data));
}

/** Texto do aviso de reajuste com as variáveis preenchidas. */
export function mensagemReajuste(modelo: string, v: { contato: string; cliente: string; numero: number; percentual: number; indice: string; data: string; valorAtual: number; valorNovo: number }) {
  const brl = (n: number) => (Number(n) || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  const mapa: Record<string, string> = {
    "{contato}": v.contato, "{cliente}": v.cliente, "{numero}": String(v.numero),
    "{percentual}": `${v.percentual.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
    "{indice}": v.indice, "{data}": v.data.split("-").reverse().join("/"),
    "{valor_atual}": brl(v.valorAtual), "{valor_novo}": brl(v.valorNovo),
  };
  return Object.entries(mapa).reduce((t, [k, val]) => t.split(k).join(val), modelo);
}

export const VARIAVEIS_REAJUSTE = ["{contato}", "{cliente}", "{numero}", "{percentual}", "{indice}", "{data}", "{valor_atual}", "{valor_novo}"];

/** Nome de arquivo seguro para o ZIP dos PDFs. */
export function nomeArquivoContrato(numero: number, cliente: string): string {
  const limpo = String(cliente || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 _-]+/g, "").trim().replace(/\s+/g, "-").slice(0, 60);
  return `contrato-${numero}${limpo ? `-${limpo}` : ""}.pdf`;
}
