/**
 * Regras puras da gestão de inadimplência do Financeiro (aba Inadimplência).
 * Situação do cliente vinda do GSystem, faixas de atraso, painel por cliente, indicadores,
 * sugestões (aviso de bloqueio, perda provável) e régua de cobrança. Testes em finance-inadimplencia.test.ts.
 */
import { round2 } from "./finance";

export type LancInad = {
  id: string;
  tipo: string;
  status: string;
  valor: number;
  vencimento: string | null;
  data_emissao?: string | null;
  data_pagamento?: string | null;
  contraparte: string | null;
  documento_contraparte: string | null;
  linha_digitavel?: string | null;
  arquivo_url?: string | null;
  origem?: string | null;
  perda_provavel?: boolean | null;
  promessa_pagamento?: string | null;
};

export type ClienteFin = {
  documento: string;
  nome?: string | null;
  situacao_gsystem?: string | null;
  ativo_gsystem?: boolean | null;
  telefone?: string | null;
  email?: string | null;
  telefone_cobranca?: string | null;
  email_cobranca?: string | null;
  regua_pausada?: boolean | null;
  observacao?: string | null;
};

export type AcaoCobranca = {
  id?: string;
  documento: string;
  tipo: string;
  canal?: string | null;
  resultado?: string | null;
  data_promessa?: string | null;
  valor?: number | null;
  parcelas?: number | null;
  primeiro_vencimento?: string | null;
  observacao?: string | null;
  created_at: string;
};

export type ConfigCobranca = {
  ativo: boolean;
  passos: { dias: number; whatsapp: boolean; email: boolean }[];
  mensagem_antes?: string | null;
  mensagem_atraso?: string | null;
  valor_minimo: number;
  so_ativos: boolean;
  dias_bloqueio: number;
  dias_perda: number;
};

export const CONFIG_PADRAO: ConfigCobranca = {
  ativo: false,
  passos: [
    { dias: -3, whatsapp: true, email: true },
    { dias: 3, whatsapp: true, email: true },
    { dias: 10, whatsapp: true, email: true },
    { dias: 30, whatsapp: true, email: true },
  ],
  valor_minimo: 0,
  so_ativos: false,
  dias_bloqueio: 30,
  dias_perda: 180,
};

export const MENSAGEM_ANTES_PADRAO =
  "Olá, {nome}! Lembrete da Online Rastreamento: a fatura de {valor} vence em {vencimento}.{link_linha}\nSe já pagou, desconsidere. Qualquer dúvida, é só responder esta mensagem.";
export const MENSAGEM_ATRASO_PADRAO =
  "Olá, {nome}! Consta em aberto a fatura de {valor}, vencida em {vencimento} ({dias} dia(s)).{link_linha}\nSe já pagou, por favor nos envie o comprovante. Se precisar combinar outra data, é só responder esta mensagem.";

// ----- utilidades -------------------------------------------------------------

export const soDigitos = (v: any): string => String(v ?? "").replace(/\D/g, "");
const sem = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
export function diasEntre(de: string, ate: string): number {
  return Math.round((Date.parse(`${ate.slice(0, 10)}T00:00:00Z`) - Date.parse(`${de.slice(0, 10)}T00:00:00Z`)) / 86_400_000);
}
export function somaDias(iso: string, dias: number): string {
  return new Date(Date.parse(`${iso.slice(0, 10)}T00:00:00Z`) + dias * 86_400_000).toISOString().slice(0, 10);
}
const brl = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataBR = (iso: string) => iso.slice(0, 10).split("-").reverse().join("/");

/** Chave do cliente: CPF/CNPJ só números; sem documento, o nome em minúsculas. */
export function chaveCliente(l: Pick<LancInad, "documento_contraparte" | "contraparte">): string {
  const d = soDigitos(l.documento_contraparte);
  if (d.length === 11 || d.length === 14) return d;
  return `nome:${sem(l.contraparte || "sem nome")}`;
}

// ----- GSystem ------------------------------------------------------------------

const primeiro = (obj: any, campos: string[]): any => {
  for (const c of campos) {
    const v = obj?.[c];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return null;
};

/** Situação do cliente como vem do GSystem: texto original e leitura ativo/inativo (null = não informado). */
export function situacaoDoGsystem(c: any): { texto: string | null; ativo: boolean | null } {
  const texto = primeiro(c, ["Situacao", "situacao", "SituacaoDescricao", "Status", "status", "StatusCliente", "Estado"]);
  const bool = primeiro(c, ["Ativo", "ativo", "Ativado", "ativado", "IsActive", "isActive"]);
  const bloq = primeiro(c, ["Bloqueado", "bloqueado", "Inativo", "inativo"]);
  if (texto != null && typeof texto !== "boolean") {
    const t = sem(String(texto));
    if (/inativ|cancel|encerr|rescind|exclu|desativ|suspens|bloque/.test(t)) return { texto: String(texto), ativo: false };
    if (/ativ|normal|regular|adimpl/.test(t)) return { texto: String(texto), ativo: true };
  }
  if (bool != null) {
    const v = bool === true || /^(true|1|s|sim)$/i.test(String(bool));
    return { texto: texto != null ? String(texto) : v ? "Ativo" : "Inativo", ativo: v };
  }
  if (bloq != null && (bloq === true || /^(true|1|s|sim)$/i.test(String(bloq)))) return { texto: texto != null ? String(texto) : "Bloqueado", ativo: false };
  return { texto: texto != null ? String(texto) : null, ativo: null };
}

/** Telefone e e-mail do cadastro do GSystem. */
export function contatoDoGsystem(c: any): { telefone: string | null; email: string | null } {
  const tel = soDigitos(primeiro(c, ["Celular", "celular", "WhatsApp", "Whatsapp", "whatsapp", "Telefone", "telefone", "Fone", "fone", "TelefoneCelular"]));
  const email = String(primeiro(c, ["EmailFinanceiro", "emailFinanceiro", "EmailCobranca", "Email", "email", "EMail"]) ?? "").trim().split(/[;,\s]+/)[0] || null;
  return { telefone: tel.length >= 10 ? tel : null, email: email && /@/.test(email) ? email.toLowerCase() : null };
}

/** Telefone para WhatsApp com DDI 55 (null se não parecer celular/fixo brasileiro). */
export function telefoneWhatsApp(t: string | null | undefined): string | null {
  let d = soDigitos(t);
  if (!d) return null;
  if (d.startsWith("0")) d = d.replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = `55${d}`;
  return d.length === 12 || d.length === 13 ? d : null;
}

// ----- faixas e painel -------------------------------------------------------

export const FAIXAS = ["1-30", "31-60", "61-90", "90+"] as const;
export type Faixa = (typeof FAIXAS)[number];
export const NOME_FAIXA: Record<Faixa, string> = { "1-30": "1 a 30 dias", "31-60": "31 a 60 dias", "61-90": "61 a 90 dias", "90+": "Mais de 90 dias" };

export function faixaDeAtraso(dias: number): Faixa {
  if (dias <= 30) return "1-30";
  if (dias <= 60) return "31-60";
  if (dias <= 90) return "61-90";
  return "90+";
}

export type SituacaoCliente = "ativo" | "inativo" | "sem_informacao";

export type ClienteInadimplente = {
  chave: string;
  documento: string | null;
  nome: string;
  valor: number;              // vencido em aberto (inclui perda provável)
  valorPerda: number;         // parte marcada como perda provável
  qtd: number;
  diasMaisAntigo: number;
  vencimentoMaisAntigo: string;
  faixa: Faixa;
  porFaixa: Record<Faixa, number>;
  aVencer: number;            // em aberto ainda não vencido
  situacao: SituacaoCliente;
  situacaoTexto: string | null;
  ultimaFatura: string | null; // vencimento/emissão mais recente de qualquer fatura não cancelada
  semFaturaDias: number | null;
  ultimaAcao: AcaoCobranca | null;
  promessa: { data: string; quebrada: boolean } | null;
  acordo: AcaoCobranca | null;
  reguaPausada: boolean;
  telefone: string | null;
  email: string | null;
  faturas: LancInad[];        // vencidas em aberto, da mais antiga para a mais nova
  sugestoes: ("bloqueio" | "perda" | "promessa_quebrada" | "sem_contato" | "inativo_com_saldo")[];
};

/**
 * Monta a lista de inadimplentes: contas a receber em aberto e vencidas, por cliente.
 * Situação: a do GSystem quando houver; sem ela, "sem informação".
 */
export function montarInadimplencia(
  lancamentos: LancInad[],
  clientes: ClienteFin[],
  acoes: AcaoCobranca[],
  hoje: string,
  config: Pick<ConfigCobranca, "dias_bloqueio" | "dias_perda"> = CONFIG_PADRAO,
): ClienteInadimplente[] {
  const cli = new Map(clientes.map((c) => [soDigitos(c.documento), c]));
  const acoesPor = new Map<string, AcaoCobranca[]>();
  for (const a of [...acoes].sort((x, y) => y.created_at.localeCompare(x.created_at))) {
    const k = soDigitos(a.documento) || a.documento;
    (acoesPor.get(k) ?? acoesPor.set(k, []).get(k)!).push(a);
  }
  const ultimaFatura = new Map<string, string>();
  const aVencer = new Map<string, number>();
  const m = new Map<string, ClienteInadimplente>();

  for (const l of lancamentos) {
    if (l.tipo !== "receber" || l.status === "cancelado") continue;
    const k = chaveCliente(l);
    const ref = l.vencimento || l.data_emissao || null;
    if (ref && (!ultimaFatura.has(k) || ref > ultimaFatura.get(k)!)) ultimaFatura.set(k, ref);
    if (l.status !== "aberto" || !l.vencimento) continue;
    if (l.vencimento >= hoje) { aVencer.set(k, round2((aVencer.get(k) ?? 0) + Number(l.valor || 0))); continue; }
    const doc = k.startsWith("nome:") ? null : k;
    let c = m.get(k);
    if (!c) {
      const fc = doc ? cli.get(doc) : undefined;
      const ativo = fc?.ativo_gsystem;
      c = {
        chave: k, documento: doc, nome: (fc?.nome || l.contraparte || "Cliente sem nome").trim(),
        valor: 0, valorPerda: 0, qtd: 0, diasMaisAntigo: 0, vencimentoMaisAntigo: l.vencimento, faixa: "1-30",
        porFaixa: { "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 }, aVencer: 0,
        situacao: ativo === true ? "ativo" : ativo === false ? "inativo" : "sem_informacao",
        situacaoTexto: fc?.situacao_gsystem ?? null, ultimaFatura: null, semFaturaDias: null,
        ultimaAcao: null, promessa: null, acordo: null, reguaPausada: !!fc?.regua_pausada,
        telefone: fc?.telefone_cobranca || fc?.telefone || null, email: fc?.email_cobranca || fc?.email || null,
        faturas: [], sugestoes: [],
      };
      m.set(k, c);
    }
    const valor = Number(l.valor || 0);
    const dias = diasEntre(l.vencimento, hoje);
    c.valor = round2(c.valor + valor);
    if (l.perda_provavel) c.valorPerda = round2(c.valorPerda + valor);
    c.qtd++;
    c.porFaixa[faixaDeAtraso(dias)] = round2(c.porFaixa[faixaDeAtraso(dias)] + valor);
    if (l.vencimento < c.vencimentoMaisAntigo) c.vencimentoMaisAntigo = l.vencimento;
    c.faturas.push(l);
  }

  for (const c of m.values()) {
    c.diasMaisAntigo = diasEntre(c.vencimentoMaisAntigo, hoje);
    c.faixa = faixaDeAtraso(c.diasMaisAntigo);
    c.faturas.sort((a, b) => (a.vencimento ?? "").localeCompare(b.vencimento ?? ""));
    c.aVencer = aVencer.get(c.chave) ?? 0;
    c.ultimaFatura = ultimaFatura.get(c.chave) ?? null;
    c.semFaturaDias = c.ultimaFatura && c.ultimaFatura < hoje ? diasEntre(c.ultimaFatura, hoje) : null;
    const hist = acoesPor.get(c.documento ?? c.chave) ?? [];
    c.ultimaAcao = hist.find((a) => a.tipo !== "regua") ?? hist[0] ?? null;
    const prom = hist.find((a) => a.tipo === "promessa" && a.data_promessa);
    // Promessa só vale se for mais recente que a fatura mais antiga em aberto ainda não coberta.
    if (prom?.data_promessa) c.promessa = { data: prom.data_promessa, quebrada: prom.data_promessa < hoje };
    c.acordo = hist.find((a) => a.tipo === "acordo") ?? null;
    if (c.situacao === "inativo") c.sugestoes.push("inativo_com_saldo");
    if (c.situacao !== "inativo" && c.diasMaisAntigo >= config.dias_bloqueio && !(c.promessa && !c.promessa.quebrada)) c.sugestoes.push("bloqueio");
    if (c.diasMaisAntigo >= config.dias_perda && c.valorPerda < c.valor) c.sugestoes.push("perda");
    if (c.promessa?.quebrada) c.sugestoes.push("promessa_quebrada");
    if (!c.telefone && !c.email) c.sugestoes.push("sem_contato");
  }
  return [...m.values()].sort((a, b) => b.valor - a.valor);
}

// ----- indicadores -------------------------------------------------------------

export type MesInad = { mes: string; faturado: number; pagoEmDia: number; pagoAtraso: number; emAberto: number; taxa: number };
export type Indicadores = {
  totalVencido: number;
  totalPerda: number;
  clientes: number;
  clientesInativos: number;
  valorInativos: number;
  taxa12m: number;            // % do valor que venceu nos últimos 12 meses e segue em aberto
  recuperadoMes: number;      // pago neste mês, de faturas que já estavam vencidas
  atrasoMedioPago: number;    // dias médios de atraso das faturas pagas nos últimos 90 dias
  porFaixa: Record<Faixa, number>;
  meses: MesInad[];           // últimos 12 meses, por mês de vencimento
};

export function indicadoresInadimplencia(lancamentos: LancInad[], lista: ClienteInadimplente[], hoje: string): Indicadores {
  const mesAtual = hoje.slice(0, 7);
  const meses: string[] = [];
  const [a, mm] = mesAtual.split("-").map(Number);
  for (let i = 11; i >= 0; i--) meses.push(new Date(Date.UTC(a, mm - 1 - i, 1)).toISOString().slice(0, 7));
  const porMes = new Map<string, MesInad>(meses.map((m) => [m, { mes: m, faturado: 0, pagoEmDia: 0, pagoAtraso: 0, emAberto: 0, taxa: 0 }]));
  let recuperadoMes = 0, somaAtraso = 0, nPagos = 0;
  const de90 = somaDias(hoje, -90);
  for (const l of lancamentos) {
    if (l.tipo !== "receber" || l.status === "cancelado" || !l.vencimento) continue;
    const v = Number(l.valor || 0);
    const pm = porMes.get(l.vencimento.slice(0, 7));
    const pago = l.status === "pago";
    const atrasoPag = pago && l.data_pagamento ? diasEntre(l.vencimento, l.data_pagamento) : 0;
    if (pm && l.vencimento < hoje) {
      pm.faturado += v;
      if (pago) { if (atrasoPag > 0) pm.pagoAtraso += v; else pm.pagoEmDia += v; }
      else pm.emAberto += v;
    }
    if (pago && l.data_pagamento) {
      if (l.data_pagamento.slice(0, 7) === mesAtual && atrasoPag > 0) recuperadoMes += v;
      if (l.data_pagamento >= de90) { somaAtraso += Math.max(0, atrasoPag); nPagos++; }
    }
  }
  const linhas = meses.map((m) => {
    const x = porMes.get(m)!;
    for (const k of ["faturado", "pagoEmDia", "pagoAtraso", "emAberto"] as const) x[k] = round2(x[k]);
    x.taxa = x.faturado ? round2((x.emAberto / x.faturado) * 100) : 0;
    return x;
  });
  const fat = linhas.reduce((s, x) => s + x.faturado, 0);
  const aberto = linhas.reduce((s, x) => s + x.emAberto, 0);
  const porFaixa: Record<Faixa, number> = { "1-30": 0, "31-60": 0, "61-90": 0, "90+": 0 };
  for (const c of lista) for (const f of FAIXAS) porFaixa[f] = round2(porFaixa[f] + c.porFaixa[f]);
  const inativos = lista.filter((c) => c.situacao === "inativo");
  return {
    totalVencido: round2(lista.reduce((s, c) => s + c.valor, 0)),
    totalPerda: round2(lista.reduce((s, c) => s + c.valorPerda, 0)),
    clientes: lista.length,
    clientesInativos: inativos.length,
    valorInativos: round2(inativos.reduce((s, c) => s + c.valor, 0)),
    taxa12m: fat ? round2((aberto / fat) * 100) : 0,
    recuperadoMes: round2(recuperadoMes),
    atrasoMedioPago: nPagos ? Math.round((somaAtraso / nPagos) * 10) / 10 : 0,
    porFaixa,
    meses: linhas,
  };
}

// ----- régua de cobrança ---------------------------------------------------------

/**
 * Passo da régua devido hoje para uma fatura em aberto: o último passo já alcançado,
 * desde que alcançado há no máximo `folga` dias (ligar a régua não dispara cobrança de dívidas antigas)
 * e ainda não enviado. Passos negativos são lembretes antes do vencimento.
 */
export function passoDevido(
  vencimento: string,
  hoje: string,
  passos: ConfigCobranca["passos"],
  jaEnviados: Set<string>,
  folga = 3,
): ConfigCobranca["passos"][number] | null {
  const atraso = diasEntre(vencimento, hoje); // negativo = ainda vai vencer
  const alcancados = passos.filter((p) => atraso >= p.dias).sort((a, b) => b.dias - a.dias);
  const p = alcancados[0];
  if (!p || atraso - p.dias > folga) return null;
  if (jaEnviados.has(String(p.dias))) return null;
  return p;
}

export function mensagemCobranca(
  modelo: string | null | undefined,
  antes: boolean,
  d: { nome: string; valor: number; vencimento: string; hoje: string; link?: string | null; linhaDigitavel?: string | null },
): string {
  const base = (modelo && modelo.trim()) || (antes ? MENSAGEM_ANTES_PADRAO : MENSAGEM_ATRASO_PADRAO);
  const dias = Math.max(0, diasEntre(d.vencimento, d.hoje));
  const linkLinha = d.link ? `\nBoleto: ${d.link}` : d.linhaDigitavel ? `\nLinha digitável: ${d.linhaDigitavel}` : "";
  const primeiroNome = d.nome.split(/\s+/)[0] ?? d.nome;
  return base
    .replace(/\{nome\}/g, primeiroNome)
    .replace(/\{cliente\}/g, d.nome)
    .replace(/\{valor\}/g, brl(d.valor))
    .replace(/\{vencimento\}/g, dataBR(d.vencimento))
    .replace(/\{dias\}/g, String(dias))
    .replace(/\{link_linha\}/g, linkLinha)
    .replace(/\{link\}/g, d.link ?? "")
    .replace(/\{linha_digitavel\}/g, d.linhaDigitavel ?? "");
}

export const NOME_SUGESTAO: Record<ClienteInadimplente["sugestoes"][number], string> = {
  bloqueio: "Avaliar bloqueio/suspensão",
  perda: "Marcar como perda provável",
  promessa_quebrada: "Promessa de pagamento não cumprida",
  sem_contato: "Sem telefone/e-mail para cobrança",
  inativo_com_saldo: "Cliente inativo com saldo em aberto",
};
