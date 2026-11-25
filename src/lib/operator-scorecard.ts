// Boletim individual e comparativo entre operadores (Relatórios › Desempenho).
// Regras puras: recebe os números por operador já calculados e devolve notas 0–100,
// nota composta com pesos, pontos fortes/a desenvolver e o quadrante volume × qualidade.

export type Dimensao = "velocidade" | "produtividade" | "qualidade" | "disciplina" | "negocio";
export type Formato = "duracao" | "numero" | "decimal" | "pct" | "nota";

export type MetricaId =
  | "tmpr" | "inicio" | "tma"
  | "resolvidos" | "porHora" | "mensagens" | "horas"
  | "csat" | "reabertura"
  | "ociosidade" | "silencio"
  | "oportunidades" | "posvenda";

export type DefMetrica = {
  id: MetricaId;
  rotulo: string;
  dimensao: Dimensao;
  /** "menor" = quanto menor melhor. "neutra" = só informativa (não entra na nota). */
  sentido: "maior" | "menor" | "neutra";
  formato: Formato;
  sugestao: string;
};

export const DIMENSOES: { id: Dimensao; rotulo: string }[] = [
  { id: "velocidade", rotulo: "Velocidade" },
  { id: "produtividade", rotulo: "Produtividade" },
  { id: "qualidade", rotulo: "Qualidade" },
  { id: "disciplina", rotulo: "Disciplina" },
  { id: "negocio", rotulo: "Negócio" },
];

export const PESOS_PADRAO: Record<Dimensao, number> = {
  velocidade: 25, qualidade: 30, produtividade: 25, disciplina: 20, negocio: 0,
};

export const METRICAS: DefMetrica[] = [
  { id: "tmpr", rotulo: "Primeira resposta (TMPR)", dimensao: "velocidade", sentido: "menor", formato: "duracao",
    sugestao: "Revisar a fila no início de cada bloco de trabalho e usar respostas rápidas para o primeiro contato." },
  { id: "inicio", rotulo: "Tempo até começar", dimensao: "velocidade", sentido: "menor", formato: "duracao",
    sugestao: "Assumir o atendimento logo ao receber; combinar uma meta de início com o gestor." },
  { id: "tma", rotulo: "Tempo médio de atendimento (TMA)", dimensao: "velocidade", sentido: "menor", formato: "duracao",
    sugestao: "Acompanhar com quem é referência nas mesmas categorias e revisar os casos mais longos." },
  { id: "resolvidos", rotulo: "Finalizados", dimensao: "produtividade", sentido: "maior", formato: "numero",
    sugestao: "Verificar se a distribuição da fila está equilibrada e se há bloqueios que impedem finalizar." },
  { id: "porHora", rotulo: "Finalizados por hora logada", dimensao: "produtividade", sentido: "maior", formato: "decimal",
    sugestao: "Cruzar com os horários de pico e reduzir interrupções durante a jornada." },
  { id: "mensagens", rotulo: "Mensagens enviadas", dimensao: "produtividade", sentido: "maior", formato: "numero",
    sugestao: "Manter o cliente informado ao longo do atendimento, não só no início e no fim." },
  { id: "horas", rotulo: "Horas logadas", dimensao: "produtividade", sentido: "neutra", formato: "decimal", sugestao: "" },
  { id: "csat", rotulo: "Satisfação (CSAT)", dimensao: "qualidade", sentido: "maior", formato: "nota",
    sugestao: "Ouvir os atendimentos com nota baixa e treinar linguagem e confirmação de solução." },
  { id: "reabertura", rotulo: "Reabertura", dimensao: "qualidade", sentido: "menor", formato: "pct",
    sugestao: "Confirmar com o cliente que o problema foi resolvido antes de finalizar." },
  { id: "ociosidade", rotulo: "Chats ociosos", dimensao: "disciplina", sentido: "menor", formato: "pct",
    sugestao: "Evitar deixar o cliente sem resposta; usar lembretes e avisar quando houver espera." },
  { id: "silencio", rotulo: "Abertos sem interação agora", dimensao: "disciplina", sentido: "menor", formato: "numero",
    sugestao: "Fazer uma varredura diária dos atendimentos parados e dar retorno ao cliente." },
  { id: "oportunidades", rotulo: "Oportunidades no CRM", dimensao: "negocio", sentido: "maior", formato: "numero",
    sugestao: "Registrar no CRM os pedidos de serviço e produto identificados nas conversas." },
  { id: "posvenda", rotulo: "Contatos de pós-venda", dimensao: "negocio", sentido: "maior", formato: "numero",
    sugestao: "Cumprir a cadência de contatos da carteira de pós-venda." },
];

export const DEF = Object.fromEntries(METRICAS.map((m) => [m.id, m])) as Record<MetricaId, DefMetrica>;

export type ValoresOperador = {
  operatorId: string;
  operatorName: string;
  /** null = sem dado (não entra na média nem na nota). */
  valores: Partial<Record<MetricaId, number | null>>;
};

export type Boletim = ValoresOperador & {
  notas: Partial<Record<MetricaId, number>>;
  dimensoes: Partial<Record<Dimensao, number>>;
  nota: number | null;
  fortes: MetricaId[];
  aDesenvolver: MetricaId[];
  quadrante: Quadrante | null;
};

export type Quadrante = "Referência" | "Pressa" | "Cuidadoso" | "Atenção";

const temValor = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Média da equipe por métrica (só quem tem dado). */
export function mediaEquipe(ops: ValoresOperador[]): Partial<Record<MetricaId, number>> {
  const out: Partial<Record<MetricaId, number>> = {};
  for (const m of METRICAS) {
    const vs = ops.map((o) => o.valores[m.id]).filter(temValor);
    if (vs.length) out[m.id] = vs.reduce((a, b) => a + b, 0) / vs.length;
  }
  return out;
}

/**
 * Nota 0–100 de um valor dentro da equipe (posição relativa): 100 = melhor da equipe,
 * 0 = pior; empates dividem a posição. Com um único operador com dado, a nota é 50.
 */
export function notaRelativa(valor: number, todos: number[], sentido: "maior" | "menor"): number {
  const n = todos.length;
  if (n <= 1) return 50;
  let piores = 0, iguais = 0;
  for (const v of todos) {
    if (v === valor) iguais++;
    else if (sentido === "maior" ? v < valor : v > valor) piores++;
  }
  return Math.round(((piores + (iguais - 1) / 2) / (n - 1)) * 100);
}

/** Média ponderada das dimensões presentes (pesos renormalizados). */
export function notaComposta(dims: Partial<Record<Dimensao, number>>, pesos: Record<Dimensao, number>): number | null {
  let soma = 0, peso = 0;
  for (const d of DIMENSOES) {
    const v = dims[d.id];
    const p = Math.max(0, pesos[d.id] ?? 0);
    if (!temValor(v) || p === 0) continue;
    soma += v * p;
    peso += p;
  }
  return peso ? Math.round(soma / peso) : null;
}

export function mediana(vs: number[]): number {
  if (!vs.length) return 0;
  const s = [...vs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** Monta o boletim de todos: notas por métrica, por dimensão, composta, destaques e quadrante. */
export function montarBoletins(ops: ValoresOperador[], pesos: Record<Dimensao, number> = PESOS_PADRAO): Boletim[] {
  const porMetrica = new Map<MetricaId, number[]>();
  for (const m of METRICAS) {
    if (m.sentido === "neutra") continue;
    porMetrica.set(m.id, ops.map((o) => o.valores[m.id]).filter(temValor));
  }
  const parcial = ops.map((o) => {
    const notas: Partial<Record<MetricaId, number>> = {};
    for (const m of METRICAS) {
      if (m.sentido === "neutra") continue;
      const v = o.valores[m.id];
      if (!temValor(v)) continue;
      notas[m.id] = notaRelativa(v, porMetrica.get(m.id)!, m.sentido);
    }
    const dimensoes: Partial<Record<Dimensao, number>> = {};
    for (const d of DIMENSOES) {
      const ns = METRICAS.filter((m) => m.dimensao === d.id).map((m) => notas[m.id]).filter(temValor);
      if (ns.length) dimensoes[d.id] = Math.round(ns.reduce((a, b) => a + b, 0) / ns.length);
    }
    // Destaques só fazem sentido com comparação (2+ operadores com o dado).
    const comparaveis = (Object.keys(notas) as MetricaId[]).filter((id) => (porMetrica.get(id)?.length ?? 0) >= 2);
    const ordenadas = comparaveis.sort((a, b) => notas[b]! - notas[a]!);
    const fortes = ordenadas.filter((id) => notas[id]! >= 60).slice(0, 3);
    const aDesenvolver = ordenadas.filter((id) => notas[id]! <= 40).reverse().slice(0, 3);
    return { ...o, notas, dimensoes, nota: notaComposta(dimensoes, pesos), fortes, aDesenvolver };
  });
  // Quadrante: volume (finalizados) × qualidade (nota da dimensão), cortes pela mediana.
  const vols = parcial.map((b) => b.valores.resolvidos).filter(temValor);
  const quals = parcial.map((b) => b.dimensoes.qualidade).filter(temValor);
  const mv = mediana(vols), mq = mediana(quals);
  return parcial.map((b) => {
    const v = b.valores.resolvidos, q = b.dimensoes.qualidade;
    let quadrante: Quadrante | null = null;
    if (temValor(v) && temValor(q) && vols.length >= 2) {
      const altoV = v >= mv, altaQ = q >= mq;
      quadrante = altoV && altaQ ? "Referência" : altoV ? "Pressa" : altaQ ? "Cuidadoso" : "Atenção";
    }
    return { ...b, quadrante };
  });
}

/** Horas logadas a partir das sessões de presença (fim = ended_at ou último sinal). */
export function horasLogadas(sessoes: { user_id: string; started_at: string; last_ping_at: string; ended_at: string | null }[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const s of sessoes) {
    const ini = Date.parse(s.started_at);
    const fim = Date.parse(s.ended_at || s.last_ping_at);
    if (!Number.isFinite(ini) || !Number.isFinite(fim) || fim <= ini) continue;
    out.set(s.user_id, (out.get(s.user_id) ?? 0) + (fim - ini) / 3_600_000);
  }
  return out;
}

/** Semana (segunda-feira, AAAA-MM-DD) de uma data ISO, no fuso de São Paulo. */
export function semanaDe(iso: string): string {
  const d = new Date(new Date(iso).toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  const dia = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dia);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatarValor(v: number | null | undefined, f: Formato): string {
  if (!temValor(v)) return "—";
  switch (f) {
    case "duracao": {
      const min = v / 60000;
      if (min < 1) return `${Math.round(v / 1000)}s`;
      if (min < 60) return `${Math.round(min)} min`;
      const h = min / 60;
      return h < 24 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} d`;
    }
    case "pct": return `${(v * 100).toFixed(0)}%`;
    case "nota": return v.toFixed(1);
    case "decimal": return v.toFixed(1);
    default: return String(Math.round(v));
  }
}

/** Diferença em relação à média já com o sinal de "melhor/pior" do sentido da métrica. */
export function comparacaoMedia(v: number | null | undefined, media: number | undefined, sentido: DefMetrica["sentido"]): "melhor" | "pior" | "igual" | null {
  if (!temValor(v) || !temValor(media) || sentido === "neutra") return null;
  if (media === 0 && v === 0) return "igual";
  const rel = media === 0 ? 1 : (v - media) / Math.abs(media);
  if (Math.abs(rel) < 0.05) return "igual";
  const maior = v > media;
  return (sentido === "maior") === maior ? "melhor" : "pior";
}
