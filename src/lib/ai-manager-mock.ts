// Mock data para o módulo "Relatório do Gerente IA".
// Substituir por server function chamando Lovable AI Gateway com Output.object (Zod).

export type CustomerInsight = {
  id: string;
  name: string;
  ticketsLast30: number;
  ticketsLast60: number;
  ticketsLast90: number;
  recurringIssue: string;
  insatisfactionScore: number; // 0..100 (alto = mais insatisfeito)
  lastInteraction: string; // ISO
  churnRisk: "baixo" | "medio" | "alto";
};

export type OpportunityInsight = {
  id: string;
  customer: string;
  description: string;
  potentialValue: string;
  confidence: number; // 0..100
};

export type RecurringProblem = {
  problem: string;
  count: number;
  recurrencePct: number;
};

export type OperatorPerformance = {
  id: string;
  name: string;
  sector: string;
  attendances: number;
  avgHandlingMinutes: number;
  csat: number; // 1..5
  reopenedTickets: number;
  communicationScore: number; // 0..100
};

export type SectorPerformance = {
  sector: string;
  attendances: number;
  avgHandlingMinutes: number;
  csat: number;
  resolutionRate: number; // 0..100
  communicationScore: number;
};

export type ForecastPoint = {
  label: string;
  actual?: number;
  predicted?: number;
};

export type SentimentHeatPoint = {
  customer: string;
  day: string; // YYYY-MM-DD
  riskScore: number; // 0..100
};

export type TrainingRecommendation = {
  target: string;
  scope: "operador" | "setor";
  topic: string;
  reason: string;
};

export type ProactiveAlert = {
  id: string;
  severity: "info" | "warning" | "critical";
  title: string;
  detail: string;
  createdAt: string;
};

// ===== CUSTOMERS =====
export const mockCustomers: CustomerInsight[] = [
  {
    id: "c1",
    name: "Gráfica Modelo Ltda",
    ticketsLast30: 6,
    ticketsLast60: 11,
    ticketsLast90: 14,
    recurringIssue: "Falhas de impressão em multifuncional Ricoh MP C4504",
    insatisfactionScore: 82,
    lastInteraction: "2026-05-14T15:22:00Z",
    churnRisk: "alto",
  },
  {
    id: "c2",
    name: "Escritório Andrade Advogados",
    ticketsLast30: 4,
    ticketsLast60: 7,
    ticketsLast90: 9,
    recurringIssue: "Toner acabando recorrentemente — pedidos manuais",
    insatisfactionScore: 58,
    lastInteraction: "2026-05-15T10:11:00Z",
    churnRisk: "medio",
  },
  {
    id: "c3",
    name: "Clínica Vida Plena",
    ticketsLast30: 3,
    ticketsLast60: 5,
    ticketsLast90: 6,
    recurringIssue: "Lentidão na rede — switch saturado",
    insatisfactionScore: 64,
    lastInteraction: "2026-05-13T09:30:00Z",
    churnRisk: "medio",
  },
  {
    id: "c4",
    name: "Auto Peças Brasil",
    ticketsLast30: 2,
    ticketsLast60: 3,
    ticketsLast90: 4,
    recurringIssue: "Dúvidas sobre digitalização para nuvem",
    insatisfactionScore: 22,
    lastInteraction: "2026-05-12T17:00:00Z",
    churnRisk: "baixo",
  },
  {
    id: "c5",
    name: "Indústria Têxtil Norte",
    ticketsLast30: 5,
    ticketsLast60: 9,
    ticketsLast90: 13,
    recurringIssue: "Atolamentos em impressora de etiquetas",
    insatisfactionScore: 71,
    lastInteraction: "2026-05-15T08:42:00Z",
    churnRisk: "alto",
  },
  {
    id: "c6",
    name: "Supermercado Bom Preço",
    ticketsLast30: 1,
    ticketsLast60: 2,
    ticketsLast90: 3,
    recurringIssue: "Configuração de leitor de código de barras",
    insatisfactionScore: 18,
    lastInteraction: "2026-05-09T13:00:00Z",
    churnRisk: "baixo",
  },
  {
    id: "c7",
    name: "Construtora Horizonte",
    ticketsLast30: 3,
    ticketsLast60: 4,
    ticketsLast90: 5,
    recurringIssue: "Falhas intermitentes em VPN entre filiais",
    insatisfactionScore: 49,
    lastInteraction: "2026-05-14T11:25:00Z",
    churnRisk: "medio",
  },
  {
    id: "c8",
    name: "Escola Aprender +",
    ticketsLast30: 2,
    ticketsLast60: 3,
    ticketsLast90: 4,
    recurringIssue: "Bloqueio de impressão por cota de aluno",
    insatisfactionScore: 31,
    lastInteraction: "2026-05-10T14:00:00Z",
    churnRisk: "baixo",
  },
];

export const mockOpportunities: OpportunityInsight[] = [
  {
    id: "o1",
    customer: "Gráfica Modelo Ltda",
    description:
      "Cliente abriu 4 chamados de toner em 30 dias. Forte candidato para contrato de outsourcing de impressão (páginas/mês).",
    potentialValue: "R$ 4.800/mês",
    confidence: 88,
  },
  {
    id: "o2",
    customer: "Escritório Andrade Advogados",
    description:
      "Volume crescente de pedidos manuais de suprimento — proposta de plano de suprimento automático com alertas via WhatsApp.",
    potentialValue: "R$ 1.200/mês",
    confidence: 74,
  },
  {
    id: "o3",
    customer: "Clínica Vida Plena",
    description:
      "Lentidão recorrente indica necessidade de upgrade de switch gerenciável + projeto de cabeamento Cat6.",
    potentialValue: "R$ 9.500 (projeto)",
    confidence: 66,
  },
  {
    id: "o4",
    customer: "Construtora Horizonte",
    description:
      "Falhas em VPN entre filiais → oportunidade de SD-WAN gerenciado mensal.",
    potentialValue: "R$ 2.300/mês",
    confidence: 58,
  },
];

export const mockRecurringProblems: RecurringProblem[] = [
  { problem: "Falhas de impressão", count: 34, recurrencePct: 47 },
  { problem: "Suprimento de toner", count: 27, recurrencePct: 39 },
  { problem: "Lentidão de rede", count: 19, recurrencePct: 28 },
  { problem: "Configuração de scanner", count: 12, recurrencePct: 14 },
  { problem: "VPN/Acesso remoto", count: 9, recurrencePct: 11 },
];

export const mockCustomerInsightsMarkdown = `
## Insights do Gerente IA — Clientes

- **Risco de churn alto** identificado em *Gráfica Modelo Ltda* e *Indústria Têxtil Norte*. Recomenda-se contato proativo do gestor comercial em até 48h.
- **Padrão de recorrência**: 47% dos chamados de impressão estão concentrados em 3 clientes — vale revisar contratos de manutenção preventiva.
- **Oportunidade comercial relevante**: clientes com mais de 3 pedidos de toner/mês representam ~R$ 8.300 em receita recorrente potencial via plano de suprimento.
- **Satisfação**: NPS estimado das últimas 4 semanas caiu de 62 para 54 — atenção ao setor de Suporte Técnico que concentra 73% das reclamações.
`;

// ===== OPERATORS / SECTORS =====
export const mockOperators: OperatorPerformance[] = [
  { id: "u1", name: "Ana Souza",     sector: "Suporte Técnico", attendances: 142, avgHandlingMinutes: 11, csat: 4.6, reopenedTickets: 3, communicationScore: 88 },
  { id: "u2", name: "Bruno Lima",    sector: "Suporte Técnico", attendances: 128, avgHandlingMinutes: 17, csat: 3.9, reopenedTickets: 9, communicationScore: 62 },
  { id: "u3", name: "Carla Mendes",  sector: "Comercial",       attendances: 95,  avgHandlingMinutes: 9,  csat: 4.8, reopenedTickets: 1, communicationScore: 92 },
  { id: "u4", name: "Diego Rocha",   sector: "Comercial",       attendances: 88,  avgHandlingMinutes: 14, csat: 4.1, reopenedTickets: 4, communicationScore: 74 },
  { id: "u5", name: "Eliane Castro", sector: "Laboratório",     attendances: 67,  avgHandlingMinutes: 22, csat: 4.4, reopenedTickets: 2, communicationScore: 81 },
  { id: "u6", name: "Felipe Nunes",  sector: "Laboratório",     attendances: 71,  avgHandlingMinutes: 26, csat: 3.6, reopenedTickets: 7, communicationScore: 58 },
];

export const mockSectors: SectorPerformance[] = [
  { sector: "Suporte Técnico", attendances: 270, avgHandlingMinutes: 14, csat: 4.25, resolutionRate: 87, communicationScore: 75 },
  { sector: "Comercial",       attendances: 183, avgHandlingMinutes: 11, csat: 4.45, resolutionRate: 92, communicationScore: 83 },
  { sector: "Laboratório",     attendances: 138, avgHandlingMinutes: 24, csat: 4.0,  resolutionRate: 81, communicationScore: 70 },
];

export const mockOperatorImprovementsMarkdown = `
## Sugestões de Melhoria — Operadores

### Bruno Lima · Suporte Técnico
- Tempo médio acima da meta (17 min). Trabalhar **objetividade nas perguntas iniciais** e uso de respostas rápidas.
- 9 chamados reabertos — revisar checklist de validação antes de finalizar.

### Felipe Nunes · Laboratório
- CSAT 3,6 — usar linguagem mais empática e atualizar o cliente a cada 24h enquanto o equipamento está no laboratório.
- Documentar diagnóstico antes de devolver o equipamento.

### Diego Rocha · Comercial
- Boa performance, mas pode acelerar fechamento usando templates de proposta já aprovados.

## Sugestões de Melhoria — Setores

### Suporte Técnico
- Implantar **triagem por nível 1** para reduzir TMA dos especialistas.
- Treinamento sobre comunicação clara em filas com alto volume.

### Laboratório
- Padronizar comunicação de status (recebido → diagnóstico → orçamento → execução → entrega).
- Criar SLA por etapa para reduzir percepção de "esquecimento".

### Comercial
- Equipe consistente, manter o foco em **upsell** com base nos insights gerados pelo Gerente IA.
`;

// ===== Complementos =====
export const mockProactiveAlerts: ProactiveAlert[] = [
  {
    id: "a1",
    severity: "critical",
    title: "Gráfica Modelo Ltda — 4 chamados de impressão em 14 dias",
    detail: "Padrão indica problema crônico no equipamento principal. Acionar técnico sênior + comercial.",
    createdAt: "2026-05-15T08:00:00Z",
  },
  {
    id: "a2",
    severity: "warning",
    title: "Indústria Têxtil Norte — CSAT em queda",
    detail: "3 últimos atendimentos abaixo de 3 estrelas. Gestor deve ligar para o contato principal.",
    createdAt: "2026-05-14T17:30:00Z",
  },
  {
    id: "a3",
    severity: "info",
    title: "Setor Laboratório — TMA 24min (meta 18min)",
    detail: "Sugerido revisar fluxo de comunicação de etapas com o cliente.",
    createdAt: "2026-05-14T11:00:00Z",
  },
];

export const mockExecutiveSummaryMarkdown = `
## Resumo Executivo — Semana

- **Volume**: 591 atendimentos (-3% vs semana anterior).
- **CSAT geral**: 4,23 (estável).
- **Top problema**: Falhas de impressão (34 ocorrências).
- **Top oportunidade**: 4 clientes elegíveis para plano de suprimento (~R$ 8.300/mês).
- **Risco**: 2 clientes em risco alto de churn.

> Recomendação: priorizar agenda comercial para os 2 clientes em risco e abrir squad de revisão do fluxo do Laboratório.
`;

export const mockSentimentHeatmap: SentimentHeatPoint[] = (() => {
  const out: SentimentHeatPoint[] = [];
  const customers = ["Gráfica Modelo", "Têxtil Norte", "Clínica Vida Plena", "Andrade Adv.", "Construtora Horizonte"];
  for (let i = 0; i < customers.length; i++) {
    for (let d = 0; d < 14; d++) {
      const day = new Date(2026, 4, 2 + d).toISOString().slice(0, 10);
      const base = [85, 70, 60, 55, 45][i];
      const noise = Math.round(Math.sin((i + 1) * (d + 1)) * 15);
      out.push({ customer: customers[i], day, riskScore: Math.max(5, Math.min(100, base + noise)) });
    }
  }
  return out;
})();

export const mockForecast: ForecastPoint[] = [
  { label: "Sem -3", actual: 612 },
  { label: "Sem -2", actual: 588 },
  { label: "Sem -1", actual: 605 },
  { label: "Atual",  actual: 591 },
  { label: "Sem +1", predicted: 598 },
  { label: "Sem +2", predicted: 615 },
  { label: "Sem +3", predicted: 622 },
];

export const mockTrainingRecommendations: TrainingRecommendation[] = [
  { target: "Bruno Lima",      scope: "operador", topic: "Comunicação objetiva e respostas rápidas", reason: "TMA 17min e 9 reaberturas." },
  { target: "Felipe Nunes",    scope: "operador", topic: "Empatia + atualização proativa de status",   reason: "CSAT 3,6." },
  { target: "Suporte Técnico", scope: "setor",    topic: "Triagem N1 e roteamento por sintoma",       reason: "73% das reclamações." },
  { target: "Laboratório",     scope: "setor",    topic: "SLA por etapa e comunicação visual",        reason: "TMA 24min e percepção de 'esquecimento'." },
];

export const mockCommercialMapMarkdown = `
## Mapa de Oportunidades Comerciais

- **Gráfica Modelo Ltda** → Outsourcing de impressão (R$ 4.800/mês) — confiança 88%
- **Escritório Andrade** → Plano de suprimento automático (R$ 1.200/mês) — confiança 74%
- **Clínica Vida Plena** → Projeto de rede + switch (R$ 9.500) — confiança 66%
- **Construtora Horizonte** → SD-WAN gerenciado (R$ 2.300/mês) — confiança 58%

Total potencial estimado: **R$ 8.300/mês recorrente + R$ 9.500 em projeto**.
`;
