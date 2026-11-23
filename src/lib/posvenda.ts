/**
 * Regras puras do Pós-venda (CRM). Testadas em posvenda.test.ts.
 * A carteira vem das faturas do GSystem importadas no Financeiro (receita por cliente);
 * aqui ficam curva ABC, cadência, saúde/risco, sugestões, métricas e os roteiros de contato.
 */

export type Classe = "A" | "B" | "C";
export type Risco = "alto" | "medio" | "baixo";
export type Sentimento = "positivo" | "neutro" | "negativo";

/** Dias entre contatos por classe: A quinzenal, B mensal, C trimestral. */
export const CADENCIA_DIAS: Record<Classe, number> = { A: 15, B: 30, C: 90 };
export const CADENCIA_LABEL: Record<Classe, string> = { A: "Quinzenal", B: "Mensal", C: "Trimestral" };

/** Corte da curva ABC sobre a receita acumulada: até 80% = A, até 95% = B, resto = C. */
export const CORTE_A = 0.8;
export const CORTE_B = 0.95;

export type ClienteCarteira = {
  id: string;
  nome: string;
  documento: string;
  receita_mensal: number;
  vencidas_valor: number;
  vencidas_qtd: number;
  vencidas_dias?: number | null; // atraso da fatura mais antiga (migração 0070)
  classe: Classe;
  classe_manual?: Classe | null;
  primeira_fatura_em?: string | null;
  ultimo_contato_em?: string | null;
  proximo_contato_em?: string | null;
  ultimo_nps?: number | null;
  ultimo_sentimento?: Sentimento | null;
  diagnostico_em?: string | null;
  frota_total?: number | null;
  interesses?: string[] | null;
  /** Reconnect: placas do cliente sem comunicação na última importação. */
  rc_placas_paradas?: number | null;
  rc_dias_max?: number | null;
  /** Placas paradas que já foram notificadas e continuam sem comunicar. */
  rc_notificadas?: number | null;
};

export type ContatoPosVenda = {
  carteira_id: string;
  data: string; // AAAA-MM-DD
  resultado: "realizado" | "sem_resposta" | "reagendado";
  nps?: number | null;
  sentimento?: Sentimento | null;
  oportunidade?: string | null;
  oportunidade_valor?: number | null;
  tipo?: string | null;
};

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Classe efetiva: a manual (definida pelo gestor) vence a calculada. */
export const classeDe = (c: Pick<ClienteCarteira, "classe" | "classe_manual">): Classe => c.classe_manual ?? c.classe;

/**
 * Curva ABC pela receita mensal. Ordena da maior para a menor e marca pela participação
 * acumulada ANTES do cliente entrar (assim o maior cliente é sempre A).
 */
export function classificarABC(clientes: { documento: string; receita_mensal: number }[]): Map<string, Classe> {
  const ord = [...clientes].sort((a, b) => b.receita_mensal - a.receita_mensal || a.documento.localeCompare(b.documento));
  const total = ord.reduce((s, c) => s + Math.max(0, c.receita_mensal), 0);
  const out = new Map<string, Classe>();
  let acum = 0;
  for (const c of ord) {
    const antes = total > 0 ? acum / total : 1;
    out.set(c.documento, c.receita_mensal <= 0 ? "C" : antes < CORTE_A ? "A" : antes < CORTE_B ? "B" : "C");
    acum += Math.max(0, c.receita_mensal);
  }
  return out;
}

export function somaDias(iso: string, dias: number): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

export function diasEntre(a: string, b: string): number {
  return Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86_400_000);
}

/** Próximo contato: data informada, senão último contato + cadência, senão hoje (nunca contatado). */
export function proximoContato(c: Pick<ClienteCarteira, "classe" | "classe_manual" | "ultimo_contato_em">, hoje: string, informado?: string | null): string {
  if (informado) return informado;
  if (c.ultimo_contato_em) return somaDias(c.ultimo_contato_em, CADENCIA_DIAS[classeDe(c)]);
  return hoje;
}

export type Situacao = "atrasado" | "hoje" | "em_dia";
export function situacaoContato(proximo: string | null | undefined, hoje: string): Situacao {
  if (!proximo || proximo < hoje) return "atrasado";
  return proximo === hoje ? "hoje" : "em_dia";
}

/**
 * Saúde do cliente (0 a 100). Parte de 100 e desconta:
 * - faturas vencidas: até 35 (proporcional ao valor vencido sobre a receita mensal);
 * - contato atrasado: até 25 (proporcional aos dias além da cadência);
 * - último NPS: detrator (0–6) 25, neutro (7–8) 10;
 * - último sentimento negativo: 15;
 * - placas sem comunicação no Reconnect: até 25 (pela pior placa, +5 se já foi avisado e não voltou).
 */
export function saudeCliente(c: ClienteCarteira, hoje: string): number {
  let s = 100;
  if (c.vencidas_valor > 0) {
    const base = c.receita_mensal > 0 ? c.vencidas_valor / c.receita_mensal : 1;
    s -= Math.min(35, Math.round(15 + 20 * Math.min(1, base / 2)));
  }
  const cad = CADENCIA_DIAS[classeDe(c)];
  const ref = c.ultimo_contato_em ?? c.primeira_fatura_em ?? null;
  const atraso = ref ? diasEntre(ref, hoje) - cad : cad;
  if (atraso > 0) s -= Math.min(25, Math.round((atraso / cad) * 25));
  if (c.ultimo_nps != null) s -= c.ultimo_nps <= 6 ? 25 : c.ultimo_nps <= 8 ? 10 : 0;
  if (c.ultimo_sentimento === "negativo") s -= 15;
  s -= descontoReconnect(c);
  return Math.max(0, Math.min(100, s));
}

/** Desconto da saúde pelas placas paradas: 1-10 dias 5, 11-20 10, 21-30 15, 31+ 20; +5 se notificado sem retorno. */
export function descontoReconnect(c: Pick<ClienteCarteira, "rc_placas_paradas" | "rc_dias_max" | "rc_notificadas">): number {
  if (!c.rc_placas_paradas || c.rc_placas_paradas <= 0) return 0;
  const d = c.rc_dias_max ?? 0;
  const base = d > 30 ? 20 : d > 20 ? 15 : d > 10 ? 10 : 5;
  return Math.min(25, base + ((c.rc_notificadas ?? 0) > 0 ? 5 : 0));
}

export function riscoDe(saude: number): Risco {
  return saude < 50 ? "alto" : saude < 75 ? "medio" : "baixo";
}

export type Sugestao = { roteiro: RoteiroKey; texto: string; prioridade: 1 | 2 | 3 };

/** Sugestões do que o pós-venda deve fazer com o cliente, da mais urgente para a menos. */
export function sugestoesCliente(c: ClienteCarteira, hoje: string): Sugestao[] {
  const out: Sugestao[] = [];
  const classe = classeDe(c);
  const saude = saudeCliente(c, hoje);
  if (riscoDe(saude) === "alto") out.push({ roteiro: "retencao", prioridade: 1, texto: "Risco alto de cancelamento: ligar, entender a insatisfação e propor plano de ação." });
  if (c.ultimo_nps != null && c.ultimo_nps <= 6) out.push({ roteiro: "retencao", prioridade: 1, texto: `NPS ${c.ultimo_nps} (detrator): retornar em até 48h com uma solução para a reclamação.` });
  if (c.rc_placas_paradas && c.rc_placas_paradas > 0) {
    const d = c.rc_dias_max ?? 0;
    const avisado = (c.rc_notificadas ?? 0) > 0 ? " Já foi avisado e não voltou:" : "";
    out.push({ roteiro: d > 20 ? "retencao" : "revisao", prioridade: d > 20 ? 1 : 2, texto: `${c.rc_placas_paradas} placa(s) sem comunicação há até ${d} dias (Reconnect).${avisado} ligar, entender o motivo e agendar a manutenção.` });
  }
  if (c.vencidas_qtd > 0) {
    const dias = c.vencidas_dias ?? null;
    const atraso = dias != null ? ` (a mais antiga há ${dias} dia(s))` : "";
    const alerta = classe === "A" && dias != null && dias > 15 ? " Cliente classe A: priorizar antes que vire cancelamento;" : "";
    out.push({ roteiro: "financeiro", prioridade: 1, texto: `${c.vencidas_qtd} fatura(s) vencida(s)${atraso}:${alerta} contato amigável, confirmar se recebeu o boleto e se há problema no serviço.` });
  }
  if (!c.diagnostico_em) {
    out.push({ roteiro: "primeiro_contato", prioridade: classe === "A" ? 1 : 2, texto: "Fazer o primeiro contato e o diagnóstico (decisor, frota total e interesses)." });
  }
  if (c.frota_total && c.frota_total > 0 && (c.interesses ?? []).includes("mais_veiculos")) {
    out.push({ roteiro: "oferta", prioridade: 2, texto: `Frota total de ${c.frota_total} veículos com interesse em ampliar: montar proposta de novos veículos.` });
  }
  if (c.primeira_fatura_em && diasEntre(c.primeira_fatura_em, hoje) <= 45 && !c.ultimo_contato_em) {
    out.push({ roteiro: "boas_vindas", prioridade: 2, texto: "Cliente novo: boas-vindas, conferir instalação, app e usuários de acesso." });
  }
  if (situacaoContato(proximoContato(c, hoje, c.proximo_contato_em), hoje) === "atrasado") {
    out.push({ roteiro: "revisao", prioridade: classe === "A" ? 1 : 2, texto: `Contato ${CADENCIA_LABEL[classe].toLowerCase()} atrasado (classe ${classe}).` });
  }
  const satisfeito = (c.ultimo_nps ?? 0) >= 9 || c.ultimo_sentimento === "positivo";
  if (classe !== "C" && satisfeito && c.vencidas_qtd === 0) {
    out.push({ roteiro: "oferta", prioridade: 2, texto: "Cliente satisfeito: oferecer câmera veicular, telemetria/bafômetro ou ampliar a frota rastreada." });
    out.push({ roteiro: "indicacao", prioridade: 3, texto: "Pedir indicação de outra empresa (cliente promotor)." });
  }
  if (classe === "A" && c.vencidas_qtd === 0 && !satisfeito) {
    out.push({ roteiro: "revisao", prioridade: 3, texto: "Cliente A: propor reunião de resultados (relatórios de uso, ocorrências e economia)." });
  }
  return out.sort((a, b) => a.prioridade - b.prioridade);
}

export type MetricasPosVenda = {
  contatosRealizados: number;
  semResposta: number;
  clientesContatados: number;
  previstos: number;
  pctCarteiraEmDia: number;
  atrasadosA: number;
  nps: number | null;
  respostasNps: number;
  oportunidades: number;
  valorOportunidades: number;
  riscoAlto: number;
  receitaEmRisco: number;
  diagnosticados: number;
  pctDiagnosticados: number;
};

/**
 * Métricas do pós-venda no período [de, ate].
 * Previstos = clientes cujo próximo contato caiu no período ou já estava atrasado.
 * NPS = % promotores (9–10) − % detratores (0–6).
 */
export function metricasPosVenda(carteira: ClienteCarteira[], contatos: ContatoPosVenda[], de: string, ate: string, hoje: string): MetricasPosVenda {
  const noPeriodo = contatos.filter((c) => c.data >= de && c.data <= ate);
  const realizados = noPeriodo.filter((c) => c.resultado === "realizado");
  const npsVals = noPeriodo.map((c) => c.nps).filter((n): n is number => n != null);
  const prom = npsVals.filter((n) => n >= 9).length;
  const detr = npsVals.filter((n) => n <= 6).length;
  const emDia = carteira.filter((c) => situacaoContato(proximoContato(c, hoje, c.proximo_contato_em), hoje) !== "atrasado").length;
  const previstos = carteira.filter((c) => {
    const p = proximoContato(c, hoje, c.proximo_contato_em);
    return p <= ate;
  }).length;
  const emRisco = carteira.filter((c) => riscoDe(saudeCliente(c, hoje)) === "alto");
  const ops = noPeriodo.filter((c) => c.oportunidade && c.oportunidade.trim());
  return {
    contatosRealizados: realizados.length,
    semResposta: noPeriodo.filter((c) => c.resultado === "sem_resposta").length,
    clientesContatados: new Set(realizados.map((c) => c.carteira_id)).size,
    previstos,
    pctCarteiraEmDia: carteira.length ? Math.round((emDia / carteira.length) * 100) : 0,
    atrasadosA: carteira.filter((c) => classeDe(c) === "A" && situacaoContato(proximoContato(c, hoje, c.proximo_contato_em), hoje) === "atrasado").length,
    nps: npsVals.length ? Math.round(((prom - detr) / npsVals.length) * 100) : null,
    respostasNps: npsVals.length,
    oportunidades: ops.length,
    valorOportunidades: r2(ops.reduce((s, c) => s + Number(c.oportunidade_valor || 0), 0)),
    diagnosticados: carteira.filter((c) => !!c.diagnostico_em).length,
    pctDiagnosticados: carteira.length ? Math.round((carteira.filter((c) => !!c.diagnostico_em).length / carteira.length) * 100) : 0,
    riscoAlto: emRisco.length,
    receitaEmRisco: r2(emRisco.reduce((s, c) => s + c.receita_mensal, 0)),
  };
}

/** Resumo da carteira por classe: clientes, receita e participação. */
export function resumoPorClasse(carteira: ClienteCarteira[]) {
  const total = carteira.reduce((s, c) => s + c.receita_mensal, 0);
  return (["A", "B", "C"] as Classe[]).map((k) => {
    const cs = carteira.filter((c) => classeDe(c) === k);
    const receita = r2(cs.reduce((s, c) => s + c.receita_mensal, 0));
    return { classe: k, clientes: cs.length, receita, participacao: total ? Math.round((receita / total) * 100) : 0 };
  });
}

// ---------------------------------------------------------------------------------------
// Roteiros (fluxos documentados). Cada contato registrado escolhe um roteiro.
// ---------------------------------------------------------------------------------------
export type RoteiroKey = "primeiro_contato" | "boas_vindas" | "revisao" | "oferta" | "financeiro" | "retencao" | "indicacao";

export const ROTEIROS: Record<RoteiroKey, { nome: string; quando: string; passos: string[] }> = {
  primeiro_contato: {
    nome: "Primeiro contato e diagnóstico",
    quando: "Todo cliente PJ da base que ainda não teve diagnóstico. Começar pelos de classe A.",
    passos: [
      "Apresentar-se como o novo responsável pelo pós-venda da Online Rastreamento.",
      "Confirmar o decisor (nome e telefone) de frota/segurança da empresa.",
      "Perguntar quantos veículos a empresa tem no total (rastreados ou não).",
      "Perguntar o que mais incomoda hoje: roubo, combustível, motorista, manutenção, multas.",
      "Marcar os interesses (câmera, telemetria, bafômetro, mais veículos, manutenção/PCM).",
      "Perguntar a nota de 0 a 10 (NPS) e registrar o próximo contato.",
    ],
  },
  boas_vindas: {
    nome: "Boas-vindas (até 45 dias)",
    quando: "Cliente novo, primeira fatura há menos de 45 dias.",
    passos: [
      "Apresentar-se como responsável pelo pós-venda e deixar o contato direto.",
      "Confirmar que todos os veículos foram instalados e estão comunicando.",
      "Conferir acesso ao app/plataforma e criar usuários que faltarem.",
      "Explicar alertas, relatórios e como abrir chamado.",
      "Agendar o próximo contato conforme a classe.",
    ],
  },
  revisao: {
    nome: "Revisão periódica",
    quando: "Classe A a cada 15 dias, B a cada 30, C a cada 90.",
    passos: [
      "Perguntar como está o uso do rastreamento e se houve algum problema.",
      "Verificar chamados abertos e ocorrências recentes do cliente.",
      "Mostrar um ganho concreto (recuperação, economia, relatório útil).",
      "Perguntar a nota de 0 a 10 (NPS) de recomendação.",
      "Registrar oportunidades percebidas e o próximo passo.",
    ],
  },
  oferta: {
    nome: "Oferta de solução (upsell)",
    quando: "Cliente satisfeito (NPS 9–10 ou sentimento positivo), sem faturas vencidas.",
    passos: [
      "Entender a dor atual da frota (segurança, custo de combustível, motorista).",
      "Sugerir a solução: câmera veicular, telemetria, bafômetro, bloqueio, mais veículos.",
      "Registrar a oportunidade com valor estimado e criar no funil de Oportunidades.",
      "Combinar data para proposta.",
    ],
  },
  financeiro: {
    nome: "Contato financeiro amigável",
    quando: "Cliente com fatura vencida.",
    passos: [
      "Confirmar se o boleto chegou e se os dados de cobrança estão certos.",
      "Perguntar se há algum problema no serviço que motivou o atraso.",
      "Reenviar o boleto ou a linha digitável se necessário.",
      "Registrar a data prometida de pagamento como próximo contato.",
    ],
  },
  retencao: {
    nome: "Retenção (risco de cancelamento)",
    quando: "Saúde abaixo de 50, NPS detrator ou pedido de cancelamento.",
    passos: [
      "Ligar (não só mensagem) e ouvir o motivo sem interromper.",
      "Abrir chamado para o problema técnico, se houver, e acompanhar até resolver.",
      "Propor plano de ação com prazo; envolver o gestor em clientes A.",
      "Retornar em até 48h com a solução e registrar o resultado.",
    ],
  },
  indicacao: {
    nome: "Pedido de indicação",
    quando: "Cliente promotor (NPS 9–10).",
    passos: [
      "Agradecer a avaliação e perguntar se conhece outra empresa com frota.",
      "Registrar nome e telefone da indicação como oportunidade.",
    ],
  },
};

export const CANAIS = [
  { key: "whatsapp", label: "WhatsApp" },
  { key: "ligacao", label: "Ligação" },
  { key: "visita", label: "Visita" },
  { key: "email", label: "E-mail" },
  { key: "reuniao", label: "Reunião online" },
] as const;

export const INTERESSES = [
  { key: "camera", label: "Câmera veicular" },
  { key: "telemetria", label: "Telemetria" },
  { key: "bafometro", label: "Bafômetro" },
  { key: "mais_veiculos", label: "Mais veículos" },
  { key: "manutencao", label: "Manutenção/PCM" },
  { key: "bloqueio", label: "Bloqueio/antifurto" },
] as const;
