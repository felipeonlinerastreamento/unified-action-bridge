/**
 * Agenda de pagamentos do Financeiro: contas a pagar aprovadas agrupadas por dia e por conta bancária,
 * com saldo estimado de cada conta. Regras puras, testadas em finance-agenda.test.ts.
 */

export type LancAgenda = {
  id: string; tipo: "pagar" | "receber"; status: string; valor: number; valor_pago?: number | null;
  vencimento: string | null; data_programada?: string | null; data_pagamento?: string | null;
  conta_bancaria_id: string | null; aprovacao?: string | null;
};
export type ContaAgenda = { id: string; nome: string; banco?: string | null; saldo_inicial: number; saldo_inicial_data?: string | null; ativo?: boolean };

const r2 = (n: number) => Math.round(n * 100) / 100;
const somaDias = (iso: string, n: number) => { const d = new Date(`${iso}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

/** Segunda-feira da semana da data. */
export function inicioSemana(iso: string): string {
  const d = new Date(`${iso}T12:00:00Z`);
  return somaDias(iso, -((d.getUTCDay() + 6) % 7));
}
export function semana(iso: string, deslocamento = 0): { de: string; ate: string } {
  const de = somaDias(inicioSemana(iso), 7 * deslocamento);
  return { de, ate: somaDias(de, 6) };
}

/** Data em que a conta vai ser paga: a programada ou, sem ela, o vencimento. */
export const dataPlanejada = (l: Pick<LancAgenda, "data_programada" | "vencimento">) => l.data_programada || l.vencimento || null;

/** Situação na agenda: pronta para pagar, aguardando aprovação ou reprovada. */
export function situacaoAgenda(l: Pick<LancAgenda, "aprovacao">): "pronto" | "aguardando" | "reprovado" {
  if (l.aprovacao === "pendente") return "aguardando";
  if (l.aprovacao === "reprovado") return "reprovado";
  return "pronto";
}

export type GrupoConta<L> = { contaId: string | null; itens: L[]; total: number };
export type DiaAgenda<L> = { data: string; atrasado: boolean; contas: GrupoConta<L>[]; total: number };

/**
 * Monta a agenda do período [de, ate]: contas a pagar em aberto e prontas (aprovadas ou sem exigência).
 * As atrasadas (data planejada antes de hoje) entram num grupo "atrasadas" no começo, na data de hoje.
 * As que aguardam aprovação no período ficam à parte.
 */
export function montarAgenda<L extends LancAgenda>(lancs: L[], de: string, ate: string, hoje: string) {
  const abertos = lancs.filter((l) => l.tipo === "pagar" && l.status === "aberto");
  const dias = new Map<string, Map<string, L[]>>();
  const atrasadas: L[] = [];
  const aguardando: L[] = [];
  let reprovadas = 0;
  for (const l of abertos) {
    const d = dataPlanejada(l);
    if (!d) continue;
    const sit = situacaoAgenda(l);
    const noPeriodo = d >= de && d <= ate;
    const atrasada = d < hoje && hoje >= de && hoje <= ate;
    if (!noPeriodo && !atrasada) continue;
    if (sit === "reprovado") { reprovadas++; continue; }
    if (sit === "aguardando") { aguardando.push(l); continue; }
    if (d < hoje) { atrasadas.push(l); continue; }
    const porConta = dias.get(d) ?? new Map<string, L[]>();
    const k = l.conta_bancaria_id ?? "";
    porConta.set(k, [...(porConta.get(k) ?? []), l]);
    dias.set(d, porConta);
  }
  const agrupar = (itens: L[]): GrupoConta<L>[] => {
    const m = new Map<string, L[]>();
    for (const l of itens) m.set(l.conta_bancaria_id ?? "", [...(m.get(l.conta_bancaria_id ?? "") ?? []), l]);
    return [...m.entries()].map(([k, it]) => ({ contaId: k || null, itens: it, total: r2(it.reduce((s, x) => s + Number(x.valor || 0), 0)) }))
      .sort((a, b) => (a.contaId === null ? 1 : b.contaId === null ? -1 : 0));
  };
  const out: DiaAgenda<L>[] = [];
  if (atrasadas.length) {
    const contas = agrupar(atrasadas);
    out.push({ data: hoje, atrasado: true, contas, total: r2(contas.reduce((s, c) => s + c.total, 0)) });
  }
  for (const [data, porConta] of [...dias.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const contas = agrupar([...porConta.values()].flat());
    out.push({ data, atrasado: false, contas, total: r2(contas.reduce((s, c) => s + c.total, 0)) });
  }
  return {
    dias: out,
    aguardando: aguardando.sort((a, b) => String(dataPlanejada(a)).localeCompare(String(dataPlanejada(b)))),
    reprovadas,
    total: r2(out.reduce((s, d) => s + d.total, 0)),
    totalAguardando: r2(aguardando.reduce((s, l) => s + Number(l.valor || 0), 0)),
  };
}

/** Saldo estimado da conta hoje: saldo inicial + recebidos − pagos lançados nela depois da data do saldo inicial. */
export function saldoEstimado(conta: ContaAgenda, lancs: LancAgenda[]): number {
  let s = Number(conta.saldo_inicial) || 0;
  for (const l of lancs) {
    if (l.conta_bancaria_id !== conta.id || l.status !== "pago") continue;
    const d = l.data_pagamento || l.vencimento;
    if (conta.saldo_inicial_data && d && d <= conta.saldo_inicial_data) continue;
    const v = Number(l.valor_pago ?? l.valor) || 0;
    s += l.tipo === "receber" ? v : -v;
  }
  return r2(s);
}

/**
 * Saldo projetado de cada conta ao fim de cada dia da agenda: parte do saldo estimado, soma os
 * recebimentos previstos naquela conta e tira os pagamentos da agenda.
 */
export function saldoProjetado(conta: ContaAgenda, lancs: LancAgenda[], dias: string[], pagamentos: Map<string, number>, hoje: string): Record<string, number> {
  let s = saldoEstimado(conta, lancs);
  const recebe = new Map<string, number>();
  for (const l of lancs) {
    if (l.conta_bancaria_id !== conta.id || l.tipo !== "receber" || l.status !== "aberto") continue;
    const d = dataPlanejada(l);
    if (!d || d < hoje) continue;
    recebe.set(d, (recebe.get(d) ?? 0) + Number(l.valor || 0));
  }
  const out: Record<string, number> = {};
  const ordenados = [...new Set(dias)].sort();
  const primeiro = ordenados[0];
  // Recebimentos entre hoje e o primeiro dia da agenda entram antes.
  for (const [d, v] of recebe) if (primeiro && d < primeiro) s += v;
  for (const d of ordenados) {
    s += recebe.get(d) ?? 0;
    s -= pagamentos.get(`${d}|${conta.id}`) ?? 0;
    out[d] = r2(s);
  }
  return out;
}

/** Linha da planilha do lote para pagar no banco. */
export function linhaLote(l: { contraparte?: string | null; documento_contraparte?: string | null; descricao?: string | null; valor: number; vencimento: string | null; data_programada?: string | null; linha_digitavel?: string | null; tipo_documento?: string | null }, conta: string) {
  return {
    "Pagar em": (l.data_programada || l.vencimento || "").split("-").reverse().join("/"),
    "Vencimento": (l.vencimento || "").split("-").reverse().join("/"),
    "Conta": conta,
    "Favorecido": l.contraparte || "",
    "CNPJ/CPF": l.documento_contraparte || "",
    "Descrição": l.descricao || "",
    "Tipo": l.tipo_documento || "",
    "Valor": Number(l.valor) || 0,
    "Linha digitável / código": l.linha_digitavel || "",
  };
}
