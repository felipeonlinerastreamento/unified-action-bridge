/**
 * Regras puras do RH: tipos de ausência, absenteísmo, turnover, férias (períodos aquisitivos, direito
 * pelo art. 130 da CLT, vencimento), banco de horas, vencimento de documentos, aniversários,
 * calendário e avisos. Testes em rh.test.ts.
 * Dias úteis contam segunda a sexta (feriados não são descontados).
 */

export type Colaborador = {
  id: string;
  user_id?: string | null;
  nome: string;
  cargo?: string | null;
  setor_id?: string | null;
  tipo_contrato?: string | null;
  data_admissao?: string | null;
  data_desligamento?: string | null;
  situacao: "ativo" | "afastado" | "desligado";
  salario?: number | null;
  data_nascimento?: string | null;
};

export type TipoAusencia =
  | "falta_injustificada" | "falta_justificada" | "atestado" | "atraso" | "saida_antecipada" | "folga"
  | "licenca_maternidade" | "licenca_paternidade" | "licenca_casamento" | "licenca_luto" | "afastamento_inss" | "suspensao" | "outro";

export type Ausencia = {
  id: string;
  colaborador_id: string;
  tipo: TipoAusencia;
  data_inicio: string;
  data_fim: string;
  minutos?: number | null;
  situacao: "pendente" | "aprovada" | "recusada";
  desconta?: boolean | null;
};

export type Ferias = {
  id: string;
  colaborador_id: string;
  aquisitivo_inicio: string;
  data_inicio: string;
  data_fim: string;
  abono_dias?: number | null;
  situacao: "planejada" | "aprovada" | "concluida" | "cancelada";
};

export type LancHoras = { colaborador_id: string; data: string; minutos: number; tipo?: string };
export type Documento = { id: string; colaborador_id: string; tipo: string; validade?: string | null };

export const TIPOS_AUSENCIA: Record<TipoAusencia, { label: string; absenteismo: boolean; porMinutos?: boolean }> = {
  falta_injustificada: { label: "Falta injustificada", absenteismo: true },
  falta_justificada: { label: "Falta justificada", absenteismo: true },
  atestado: { label: "Atestado médico", absenteismo: true },
  atraso: { label: "Atraso", absenteismo: true, porMinutos: true },
  saida_antecipada: { label: "Saída antecipada", absenteismo: true, porMinutos: true },
  folga: { label: "Folga / compensação", absenteismo: false },
  licenca_maternidade: { label: "Licença-maternidade", absenteismo: false },
  licenca_paternidade: { label: "Licença-paternidade", absenteismo: false },
  licenca_casamento: { label: "Licença casamento", absenteismo: false },
  licenca_luto: { label: "Licença nojo (luto)", absenteismo: false },
  afastamento_inss: { label: "Afastamento INSS", absenteismo: false },
  suspensao: { label: "Suspensão disciplinar", absenteismo: false },
  outro: { label: "Outro", absenteismo: false },
};

// ----- datas ------------------------------------------------------------------------

const ms = (iso: string) => Date.parse(`${iso.slice(0, 10)}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);
export const somaDias = (d: string, n: number) => iso(ms(d) + n * 86_400_000);
export const diasEntre = (de: string, ate: string) => Math.round((ms(ate) - ms(de)) / 86_400_000);
export function somaMeses(d: string, n: number): string {
  const [a, m, dia] = d.slice(0, 10).split("-").map(Number);
  const alvo = new Date(Date.UTC(a, m - 1 + n, 1));
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate();
  alvo.setUTCDate(Math.min(dia, ultimo));
  return iso(alvo.getTime());
}
const ehUtil = (d: string) => { const w = new Date(ms(d)).getUTCDay(); return w !== 0 && w !== 6; };

/** Dias úteis (seg–sex) de `de` a `ate`, inclusive. */
export function diasUteis(de: string, ate: string): number {
  if (ate < de) return 0;
  let n = 0;
  for (let t = ms(de); t <= ms(ate); t += 86_400_000) if (ehUtil(iso(t))) n++;
  return n;
}
/** Dias corridos de `de` a `ate`, inclusive. */
export const diasCorridos = (de: string, ate: string) => (ate < de ? 0 : diasEntre(de, ate) + 1);

const intersecao = (a1: string, a2: string, b1: string, b2: string): [string, string] | null => {
  const de = a1 > b1 ? a1 : b1, ate = a2 < b2 ? a2 : b2;
  return de <= ate ? [de, ate] : null;
};

// ----- absenteísmo e turnover ----------------------------------------------------------

/** Ativo em algum momento do período (admitido antes do fim e não desligado antes do início). */
export function ativoNoPeriodo(c: Colaborador, de: string, ate: string): boolean {
  if (c.data_admissao && c.data_admissao > ate) return false;
  if (c.data_desligamento && c.data_desligamento < de) return false;
  return !(c.situacao === "desligado" && !c.data_desligamento);
}

/** Horas perdidas de uma ausência dentro do período (dias úteis × jornada, ou minutos). */
export function horasPerdidas(a: Ausencia, de: string, ate: string, horasDia = 8): number {
  const i = intersecao(a.data_inicio, a.data_fim, de, ate);
  if (!i) return 0;
  if (TIPOS_AUSENCIA[a.tipo]?.porMinutos) return (a.minutos ?? 0) / 60;
  return diasUteis(i[0], i[1]) * horasDia;
}

export type Absenteismo = { taxa: number; horasPerdidas: number; horasPrevistas: number; porColaborador: Map<string, number>; porTipo: Record<string, number> };

/** Taxa de absenteísmo do período: horas perdidas (só tipos que contam) ÷ horas previstas dos ativos. */
export function absenteismo(colabs: Colaborador[], ausencias: Ausencia[], de: string, ate: string, horasDia = 8): Absenteismo {
  let previstas = 0;
  for (const c of colabs) {
    if (!ativoNoPeriodo(c, de, ate)) continue;
    const ini = c.data_admissao && c.data_admissao > de ? c.data_admissao : de;
    const fim = c.data_desligamento && c.data_desligamento < ate ? c.data_desligamento : ate;
    previstas += diasUteis(ini, fim) * horasDia;
  }
  const porColaborador = new Map<string, number>();
  const porTipo: Record<string, number> = {};
  let perdidas = 0;
  for (const a of ausencias) {
    if (a.situacao === "recusada" || !TIPOS_AUSENCIA[a.tipo]?.absenteismo) continue;
    const h = horasPerdidas(a, de, ate, horasDia);
    if (!h) continue;
    perdidas += h;
    porColaborador.set(a.colaborador_id, (porColaborador.get(a.colaborador_id) ?? 0) + h);
    porTipo[a.tipo] = (porTipo[a.tipo] ?? 0) + h;
  }
  return { taxa: previstas ? Math.round((perdidas / previstas) * 10000) / 100 : 0, horasPerdidas: Math.round(perdidas * 10) / 10, horasPrevistas: previstas, porColaborador, porTipo };
}

/** Turnover do período: ((admissões + desligamentos) ÷ 2) ÷ efetivo médio × 100. */
export function turnover(colabs: Colaborador[], de: string, ate: string): { taxa: number; admissoes: number; desligamentos: number; efetivoMedio: number } {
  const noDia = (d: string) => colabs.filter((c) => (!c.data_admissao || c.data_admissao <= d) && !(c.data_desligamento && c.data_desligamento < d) && !(c.situacao === "desligado" && !c.data_desligamento)).length;
  const admissoes = colabs.filter((c) => c.data_admissao && c.data_admissao >= de && c.data_admissao <= ate).length;
  const desligamentos = colabs.filter((c) => c.data_desligamento && c.data_desligamento >= de && c.data_desligamento <= ate).length;
  const efetivoMedio = (noDia(de) + noDia(ate)) / 2;
  return { taxa: efetivoMedio ? Math.round((((admissoes + desligamentos) / 2) / efetivoMedio) * 10000) / 100 : 0, admissoes, desligamentos, efetivoMedio };
}

// ----- férias ----------------------------------------------------------------------------

/** Dias de férias pelo número de faltas injustificadas no período aquisitivo (CLT, art. 130). */
export function diasDireitoFerias(faltasInjustificadas: number): number {
  if (faltasInjustificadas <= 5) return 30;
  if (faltasInjustificadas <= 14) return 24;
  if (faltasInjustificadas <= 23) return 18;
  if (faltasInjustificadas <= 32) return 12;
  return 0;
}

export type PeriodoFerias = {
  inicio: string;           // período aquisitivo
  fim: string;
  concessivoFim: string;    // prazo para tirar (12 meses depois do aquisitivo)
  faltas: number;
  direito: number;
  usados: number;           // gozo + abono, sem as canceladas
  saldo: number;
  situacao: "em_aquisicao" | "a_gozar" | "vencendo" | "vencida" | "quitada";
};

/** Dias de falta injustificada (corridos) dentro de um intervalo. */
function faltasNoIntervalo(ausencias: Ausencia[], colabId: string, de: string, ate: string): number {
  let n = 0;
  for (const a of ausencias) {
    if (a.colaborador_id !== colabId || a.tipo !== "falta_injustificada" || a.situacao === "recusada") continue;
    const i = intersecao(a.data_inicio, a.data_fim, de, ate);
    if (i) n += diasCorridos(i[0], i[1]);
  }
  return n;
}

/** Períodos aquisitivos desde a admissão até hoje, com direito, uso e situação. */
export function periodosFerias(c: Colaborador, ausencias: Ausencia[], ferias: Ferias[], hoje: string, diasAviso = 60): PeriodoFerias[] {
  if (!c.data_admissao || (c.tipo_contrato && !["clt", "aprendiz", "temporario"].includes(c.tipo_contrato))) return [];
  const out: PeriodoFerias[] = [];
  const limite = c.data_desligamento && c.data_desligamento < hoje ? c.data_desligamento : hoje;
  for (let k = 0; k < 60; k++) {
    const inicio = somaMeses(c.data_admissao, 12 * k);
    if (inicio > limite) break;
    const fim = somaDias(somaMeses(c.data_admissao, 12 * (k + 1)), -1);
    const concessivoFim = somaDias(somaMeses(c.data_admissao, 12 * (k + 2)), -1);
    const faltas = faltasNoIntervalo(ausencias, c.id, inicio, fim);
    const direito = diasDireitoFerias(faltas);
    const usados = ferias.filter((f) => f.colaborador_id === c.id && f.situacao !== "cancelada" && f.aquisitivo_inicio === inicio)
      .reduce((s, f) => s + diasCorridos(f.data_inicio, f.data_fim) + (f.abono_dias ?? 0), 0);
    const saldo = Math.max(0, direito - usados);
    let situacao: PeriodoFerias["situacao"];
    if (fim >= hoje) situacao = "em_aquisicao";
    else if (saldo === 0) situacao = "quitada";
    else if (concessivoFim < hoje) situacao = "vencida";
    else if (diasEntre(hoje, concessivoFim) <= diasAviso) situacao = "vencendo";
    else situacao = "a_gozar";
    out.push({ inicio, fim, concessivoFim, faltas, direito, usados, saldo, situacao });
  }
  return out;
}

// ----- banco de horas, documentos, faltas, aniversários ----------------------------------

export function saldoBancoHoras(lancs: LancHoras[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lancs) m.set(l.colaborador_id, (m.get(l.colaborador_id) ?? 0) + Number(l.minutos || 0));
  return m;
}
export const formatarMinutos = (min: number) => {
  const s = min < 0 ? "-" : "";
  const a = Math.abs(Math.round(min));
  return `${s}${Math.floor(a / 60)}h${String(a % 60).padStart(2, "0")}`;
};

export function situacaoDocumento(d: Pick<Documento, "validade">, hoje: string, diasAviso = 30): "sem_validade" | "vencido" | "vencendo" | "ok" {
  if (!d.validade) return "sem_validade";
  if (d.validade < hoje) return "vencido";
  if (diasEntre(hoje, d.validade) <= diasAviso) return "vencendo";
  return "ok";
}

/** Faltas injustificadas (dias) de cada colaborador nos últimos `dias`. */
export function faltasRecentes(ausencias: Ausencia[], hoje: string, dias: number): Map<string, number> {
  const de = somaDias(hoje, -dias);
  const m = new Map<string, number>();
  for (const a of ausencias) {
    if (a.tipo !== "falta_injustificada" || a.situacao === "recusada") continue;
    const i = intersecao(a.data_inicio, a.data_fim, de, hoje);
    if (i) m.set(a.colaborador_id, (m.get(a.colaborador_id) ?? 0) + diasCorridos(i[0], i[1]));
  }
  return m;
}

/** Próxima ocorrência (a partir de hoje) do dia/mês de uma data, e em quantos dias. */
export function proximoAniversario(data: string, hoje: string): { data: string; dias: number; anos: number } {
  const [a, m, d] = data.slice(0, 10).split("-").map(Number);
  const [ah] = hoje.split("-").map(Number);
  const mk = (ano: number) => iso(Date.UTC(ano, m - 1, Math.min(d, new Date(Date.UTC(ano, m, 0)).getUTCDate())));
  let prox = mk(ah);
  if (prox < hoje) prox = mk(ah + 1);
  return { data: prox, dias: diasEntre(hoje, prox), anos: Number(prox.slice(0, 4)) - a };
}

// ----- calendário -------------------------------------------------------------------------

export type ItemCalendario = { colaborador_id: string; tipo: TipoAusencia | "ferias"; pendente: boolean };

/** Quem está fora em cada dia do mês (ausências não recusadas e férias não canceladas). */
export function calendarioMes(mes: string, ausencias: Ausencia[], ferias: Ferias[]): Map<string, ItemCalendario[]> {
  const [a, m] = mes.split("-").map(Number);
  const de = `${mes}-01`;
  const ate = iso(Date.UTC(a, m, 0));
  const out = new Map<string, ItemCalendario[]>();
  const add = (d1: string, d2: string, item: ItemCalendario) => {
    const i = intersecao(d1, d2, de, ate);
    if (!i) return;
    for (let t = ms(i[0]); t <= ms(i[1]); t += 86_400_000) {
      const k = iso(t);
      (out.get(k) ?? out.set(k, []).get(k)!).push(item);
    }
  };
  for (const x of ausencias) if (x.situacao !== "recusada" && !TIPOS_AUSENCIA[x.tipo]?.porMinutos) add(x.data_inicio, x.data_fim, { colaborador_id: x.colaborador_id, tipo: x.tipo, pendente: x.situacao === "pendente" });
  for (const f of ferias) if (f.situacao !== "cancelada") add(f.data_inicio, f.data_fim, { colaborador_id: f.colaborador_id, tipo: "ferias", pendente: f.situacao === "planejada" });
  return out;
}

// ----- avisos -----------------------------------------------------------------------------

export type ConfigRh = { dias_aviso_documento: number; dias_aviso_ferias: number; faltas_alerta_qtd: number; faltas_alerta_dias: number; banco_horas_alerta_min: number };
export const CONFIG_RH_PADRAO: ConfigRh = { dias_aviso_documento: 30, dias_aviso_ferias: 60, faltas_alerta_qtd: 3, faltas_alerta_dias: 90, banco_horas_alerta_min: 2400 };

export type AvisoRh = { tipo: "ferias_vencida" | "ferias_vencendo" | "documento_vencido" | "documento_vencendo" | "faltas" | "banco_horas" | "ausencia_pendente" | "aniversario" | "tempo_casa"; gravidade: 1 | 2 | 3; colaborador_id: string; texto: string };

export function avisosRh(d: {
  colabs: Colaborador[]; ausencias: Ausencia[]; ferias: Ferias[]; horas: LancHoras[]; documentos: Documento[]; hoje: string; config?: ConfigRh;
}): AvisoRh[] {
  const cfg = d.config ?? CONFIG_RH_PADRAO;
  const ativos = d.colabs.filter((c) => c.situacao !== "desligado");
  const ids = new Set(ativos.map((c) => c.id));
  const dataBR = (s: string) => s.split("-").reverse().join("/");
  const out: AvisoRh[] = [];
  for (const c of ativos) {
    for (const p of periodosFerias(c, d.ausencias, d.ferias, d.hoje, cfg.dias_aviso_ferias)) {
      if (p.situacao === "vencida") out.push({ tipo: "ferias_vencida", gravidade: 1, colaborador_id: c.id, texto: `${c.nome}: férias do período ${dataBR(p.inicio)} a ${dataBR(p.fim)} vencidas em ${dataBR(p.concessivoFim)} (${p.saldo} dia(s)).` });
      else if (p.situacao === "vencendo") out.push({ tipo: "ferias_vencendo", gravidade: 2, colaborador_id: c.id, texto: `${c.nome}: ${p.saldo} dia(s) de férias para tirar até ${dataBR(p.concessivoFim)}.` });
    }
    if (c.data_nascimento) {
      const an = proximoAniversario(c.data_nascimento, d.hoje);
      if (an.dias <= 7) out.push({ tipo: "aniversario", gravidade: 3, colaborador_id: c.id, texto: `${c.nome} faz aniversário ${an.dias === 0 ? "hoje" : `em ${dataBR(an.data)}`}.` });
    }
    if (c.data_admissao) {
      const tc = proximoAniversario(c.data_admissao, d.hoje);
      if (tc.dias <= 7 && tc.anos >= 1) out.push({ tipo: "tempo_casa", gravidade: 3, colaborador_id: c.id, texto: `${c.nome} completa ${tc.anos} ano(s) de casa ${tc.dias === 0 ? "hoje" : `em ${dataBR(tc.data)}`}.` });
    }
  }
  for (const doc of d.documentos) {
    if (!ids.has(doc.colaborador_id)) continue;
    const s = situacaoDocumento(doc, d.hoje, cfg.dias_aviso_documento);
    const nome = d.colabs.find((c) => c.id === doc.colaborador_id)?.nome ?? "";
    if (s === "vencido") out.push({ tipo: "documento_vencido", gravidade: 1, colaborador_id: doc.colaborador_id, texto: `${nome}: ${doc.tipo} vencido em ${dataBR(doc.validade!)}.` });
    if (s === "vencendo") out.push({ tipo: "documento_vencendo", gravidade: 2, colaborador_id: doc.colaborador_id, texto: `${nome}: ${doc.tipo} vence em ${dataBR(doc.validade!)}.` });
  }
  for (const [id, n] of faltasRecentes(d.ausencias, d.hoje, cfg.faltas_alerta_dias)) {
    if (n >= cfg.faltas_alerta_qtd && ids.has(id)) out.push({ tipo: "faltas", gravidade: 1, colaborador_id: id, texto: `${d.colabs.find((c) => c.id === id)?.nome}: ${n} falta(s) injustificada(s) nos últimos ${cfg.faltas_alerta_dias} dias.` });
  }
  for (const [id, min] of saldoBancoHoras(d.horas)) {
    if (Math.abs(min) >= cfg.banco_horas_alerta_min && ids.has(id)) out.push({ tipo: "banco_horas", gravidade: 2, colaborador_id: id, texto: `${d.colabs.find((c) => c.id === id)?.nome}: saldo de banco de horas ${formatarMinutos(min)}.` });
  }
  const pend = d.ausencias.filter((a) => a.situacao === "pendente" && ids.has(a.colaborador_id));
  for (const a of pend) out.push({ tipo: "ausencia_pendente", gravidade: 2, colaborador_id: a.colaborador_id, texto: `${d.colabs.find((c) => c.id === a.colaborador_id)?.nome}: ${TIPOS_AUSENCIA[a.tipo].label.toLowerCase()} de ${dataBR(a.data_inicio)} aguardando aprovação.` });
  return out.sort((a, b) => a.gravidade - b.gravidade);
}

// ----- documento de advertência/suspensão ----------------------------------------------------

export const TIPOS_OCORRENCIA: Record<string, string> = {
  advertencia_verbal: "Advertência verbal", advertencia_escrita: "Advertência escrita", suspensao: "Suspensão disciplinar",
  elogio: "Elogio", feedback: "Feedback", outro: "Outro",
};

export function textoOcorrencia(d: { empresa: string; colaborador: string; cargo?: string | null; tipo: string; data: string; motivo: string; descricao?: string | null; diasSuspensao?: number | null }): { titulo: string; paragrafos: string[] } {
  const dataBR = d.data.split("-").reverse().join("/");
  if (d.tipo === "suspensao") {
    return {
      titulo: "COMUNICADO DE SUSPENSÃO DISCIPLINAR",
      paragrafos: [
        `Ao(À) colaborador(a) ${d.colaborador}${d.cargo ? `, ${d.cargo}` : ""}.`,
        `Comunicamos que, em razão de: ${d.motivo}${d.descricao ? ` (${d.descricao})` : ""}, fica Vossa Senhoria suspenso(a) de suas atividades por ${d.diasSuspensao ?? 1} dia(s), a partir de ${dataBR}, sem remuneração dos dias de suspensão.`,
        "Esclarecemos que a repetição de faltas dessa natureza poderá resultar em penalidades mais severas, conforme a legislação trabalhista.",
      ],
    };
  }
  return {
    titulo: d.tipo === "advertencia_verbal" ? "REGISTRO DE ADVERTÊNCIA VERBAL" : "ADVERTÊNCIA DISCIPLINAR",
    paragrafos: [
      `Ao(À) colaborador(a) ${d.colaborador}${d.cargo ? `, ${d.cargo}` : ""}.`,
      `Pelo presente, fica Vossa Senhoria advertido(a) em ${dataBR}, em razão de: ${d.motivo}${d.descricao ? ` (${d.descricao})` : ""}.`,
      "Solicitamos que o fato não se repita, ficando ciente de que a reincidência poderá acarretar a aplicação de penalidades mais severas, conforme a legislação trabalhista.",
    ],
  };
}
