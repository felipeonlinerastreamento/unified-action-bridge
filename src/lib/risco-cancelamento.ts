/**
 * Placar de risco de cancelamento por cliente (0 a 100 — quanto maior, mais perto de cancelar).
 * Regras puras, testadas em risco-cancelamento.test.ts. Os dados vêm da carteira do Pós-venda
 * (faturas, Reconnect, NPS, contatos) e dos chamados do cliente nos últimos 90 dias.
 */
import { CADENCIA_DIAS, classeDe, descontoReconnect, diasEntre, type ClienteCarteira } from "@/lib/posvenda";

export type NivelRisco = "alto" | "medio" | "baixo";
export type SinalRisco = "financeiro" | "comunicacao" | "chamados" | "atraso_servico" | "satisfacao" | "sem_contato";
export type MotivoRisco = { sinal: SinalRisco; pontos: number; texto: string };
export type ResultadoRisco = { nota: number; nivel: NivelRisco; motivos: MotivoRisco[] };

export type ClienteRisco = ClienteCarteira & {
  /** Chamados abertos pelo cliente nos últimos 90 dias. */
  chamados_90d?: number | null;
  /** Chamados do cliente ainda abertos há mais de 7 dias (serviço atrasado). */
  chamados_atrasados?: number | null;
};

/** A partir desta nota o cliente é "risco alto" e ganha um plano de retenção automático. */
export const LIMIAR_ALTO = 60;
export const LIMIAR_MEDIO = 35;

export const NOME_SINAL: Record<SinalRisco, string> = {
  financeiro: "Boleto atrasado",
  comunicacao: "Veículo sem comunicação",
  chamados: "Muitos chamados",
  atraso_servico: "Serviço atrasado",
  satisfacao: "Satisfação baixa",
  sem_contato: "Sem contato do pós-venda",
};

export function nivelDe(nota: number): NivelRisco {
  return nota >= LIMIAR_ALTO ? "alto" : nota >= LIMIAR_MEDIO ? "medio" : "baixo";
}

/**
 * Soma pontos por sinal (teto 100):
 * - boleto atrasado: até 30 (pelo atraso da fatura mais antiga; +5 se o vencido passa de 2 mensalidades);
 * - veículo sem comunicação (Reconnect): até 25;
 * - satisfação: NPS detrator 20, neutro 8; sentimento negativo +12 (teto 25);
 * - chamados nos últimos 90 dias: 3+ = 8, 5+ = 14, 8+ = 20;
 * - serviço atrasado (chamado aberto há mais de 7 dias): 1+ = 8, 3+ = 15;
 * - sem contato do pós-venda: passou da cadência 5, passou do dobro 10.
 */
export function riscoCancelamento(c: ClienteRisco, hoje: string): ResultadoRisco {
  const motivos: MotivoRisco[] = [];
  const add = (sinal: SinalRisco, pontos: number, texto: string) => { if (pontos > 0) motivos.push({ sinal, pontos, texto }); };

  if ((c.vencidas_qtd ?? 0) > 0) {
    const d = c.vencidas_dias ?? 0;
    let p = d > 60 ? 25 : d > 30 ? 18 : d > 15 ? 12 : 8;
    if (c.receita_mensal > 0 && c.vencidas_valor >= c.receita_mensal * 2) p += 5;
    add("financeiro", Math.min(30, p), `${c.vencidas_qtd} fatura(s) vencida(s)${d ? `, a mais antiga há ${d} dias` : ""}`);
  }

  const rc = descontoReconnect(c);
  add("comunicacao", rc, `${c.rc_placas_paradas} placa(s) sem comunicação, a pior há ${c.rc_dias_max ?? 0} dias${(c.rc_notificadas ?? 0) > 0 ? " (já avisado e não voltou)" : ""}`);

  let sat = 0;
  const partes: string[] = [];
  if (c.ultimo_nps != null && c.ultimo_nps <= 8) { sat += c.ultimo_nps <= 6 ? 20 : 8; partes.push(`NPS ${c.ultimo_nps}`); }
  if (c.ultimo_sentimento === "negativo") { sat += 12; partes.push("último contato negativo"); }
  add("satisfacao", Math.min(25, sat), partes.join(" e "));

  const ch = c.chamados_90d ?? 0;
  add("chamados", ch >= 8 ? 20 : ch >= 5 ? 14 : ch >= 3 ? 8 : 0, `${ch} chamados nos últimos 90 dias`);

  const at = c.chamados_atrasados ?? 0;
  add("atraso_servico", at >= 3 ? 15 : at >= 1 ? 8 : 0, `${at} chamado(s) aberto(s) há mais de 7 dias`);

  const cad = CADENCIA_DIAS[classeDe(c)];
  const ref = c.ultimo_contato_em ?? c.primeira_fatura_em ?? null;
  if (ref) {
    const dias = diasEntre(ref, hoje);
    add("sem_contato", dias > cad * 2 ? 10 : dias > cad ? 5 : 0, `${dias} dias sem contato do pós-venda`);
  }

  motivos.sort((a, b) => b.pontos - a.pontos);
  const nota = Math.min(100, motivos.reduce((s, m) => s + m.pontos, 0));
  return { nota, nivel: nivelDe(nota), motivos };
}

const PASSO: Record<SinalRisco, string> = {
  financeiro: "Financeiro: contato amigável sobre as faturas, confirmar recebimento do boleto e se há problema no serviço; oferecer acordo se preciso.",
  comunicacao: "Técnico: agendar manutenção das placas sem comunicação (Reconnect) e avisar o cliente da data.",
  chamados: "Atendimento: revisar os chamados recentes, achar a causa repetida e resolver na raiz.",
  atraso_servico: "Operação: priorizar os chamados abertos há mais de 7 dias e dar prazo ao cliente.",
  satisfacao: "Pós-venda: ligar para o decisor, ouvir a reclamação e combinar um plano com prazo.",
  sem_contato: "Pós-venda: retomar a cadência de contato (reunião de resultados).",
};

/** Plano de retenção: um passo por sinal encontrado, do mais pesado para o mais leve. */
export function planoRetencao(r: ResultadoRisco): string[] {
  return r.motivos.map((m) => PASSO[m.sinal]);
}

/** Texto da tarefa de retenção criada para o responsável do cliente. */
export function descricaoPlano(nome: string, r: ResultadoRisco): string {
  return [
    `Risco de cancelamento ${r.nota}/100 (${nome}).`,
    "",
    "Sinais:",
    ...r.motivos.map((m) => `• ${NOME_SINAL[m.sinal]} (+${m.pontos}): ${m.texto}`),
    "",
    "Plano de retenção:",
    ...planoRetencao(r).map((p, i) => `${i + 1}. ${p}`),
  ].join("\n");
}
