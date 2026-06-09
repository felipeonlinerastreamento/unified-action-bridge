
## Objetivo

Ampliar o relatório **Relatórios → Desempenho por Operador** com métricas que respondam:
1. A equipe está realmente trabalhando? (tempo sem interação, atraso de início, padrão de finalização)
2. A equipe entrega com qualidade? (CSAT, reabertura, fechar sem mensagem)
3. **Eu preciso desta equipe deste tamanho?** (capacidade ociosa, concentração de volume, gargalo de setor)

Tudo recortado por **operador** e por **setor**, respeitando `business_hours_settings` (horário comercial) e considerando "parado" a partir de **15 min** sem interação.

---

## Novas seções no relatório

### Seção A — Atraso e Silêncio
- **Atraso de início** (médio + p90): `created_at` do ticket/chat → primeira ação do operador (primeira msg `from_me=true` não-whisper, ou aceite).
- **Tempo sem interação em abertos** (snapshot agora): para cada ticket/chat ainda aberto, calcular `now() - last_message_at` e agregar (médio, p90, qtd > 15 min).
- **Top "silenciosos"**: tabela com chamados abertos parados há mais tempo, com operador e setor responsáveis.

### Seção B — Padrão de finalização
- **Distribuição por hora do dia** (heatmap simples / bar chart): em que hora os atendimentos são fechados.
- **% fechados nos últimos 30 min do expediente** (usa `business_hours_settings`) — sinal de "empurrar pro fim".
- **Fechamentos sem mensagem**: usa flag de finalização sem mensagem; mostra % por operador e por setor.

### Seção C — Qualidade
- **CSAT médio** (de `csat_responses`) por operador/setor + nº de respostas.
- **Taxa de reabertura**: tickets/chats com status `reaberto` ÷ finalizados.
- **% finalizou sem mensagem** (também é qualidade).

### Seção D — Diagnóstico de Equipe (admin/gestor)
- **Capacidade ociosa por operador**: horas online (`profiles.last_seen_at` ativo) sem chat/ticket atribuído, no período.
- **Concentração**: gráfico mostrando % do volume total resolvido pelo top‑3, top‑5 — se top‑3 fizer >70%, sinaliza overstaffing.
- **Throughput por headcount do setor**: `finalizados ÷ nº de operadores ativos` por setor.
- **Setor gargalo**: cruzamento TMA × fila × volume aberto (já parcialmente em `computeSectorBottlenecks`).
- **Recomendação automática** (regra simples, sem IA): rótulo por operador entre `Alto desempenho`, `Subutilizado`, `Sobrecarregado`, `Atenção` baseado em throughput + ociosidade + atraso.

---

## Filtros (topo do relatório, já existem parcialmente)
- Período (datas)
- Setor (multi)
- Operador (multi)
- Fonte: chat / atendimento / ambos (já existe)
- Toggle "Considerar horário comercial" (default ligado)

---

## Exportação
Adicionar essas seções aos exports já existentes (CSV/XLSX/PDF em `components/relatorios/export-utils.ts`).

---

## Detalhes técnicos

### Arquivos a alterar/criar
- `src/lib/operator-metrics.ts` — adicionar funções puras:
  - `computeStartDelay(chats, tickets, messages, ops, businessHours)`
  - `computeOpenSilence(chats, tickets, messages, ops, thresholdMs=15min)`
  - `computeClosingPattern(chats, tickets, businessHours)` → buckets por hora + % últimos 30 min
  - `computeQuality(chats, tickets, csat, ops)` → CSAT, reabertura, fechar-sem-msg
  - `computeTeamDiagnostic(...)` → ociosidade, concentração, throughput/headcount, rótulo
- `src/components/relatorios/operator-performance-tab.tsx` — novas sub-abas/seções: **Atraso & Silêncio**, **Finalização**, **Qualidade**, **Diagnóstico de Equipe**. Reaproveitar `ReportKpiCard` e Recharts já existentes.
- `src/lib/operator-metrics.functions.ts` (novo) — server function que busca:
  - `zapi_chats` + `zapi_messages` (já feito hoje no tab)
  - `service_tickets` + `csat_responses`
  - `profiles` (presença/last_seen_at)
  - `sectors` + `user_sector_assignments` (para headcount por setor)
  - `business_hours_settings` (para ajuste de horário)
  Centraliza no servidor para evitar N chamadas do componente.
- `src/components/relatorios/export-utils.ts` — incluir novas colunas nos exports.

### Cálculo com horário comercial
- Helper `subtractOutOfHoursMs(startISO, endISO, businessHours)` em `src/lib/business-hours.server.ts` (já existe parte da infra) usado em **atraso de início**, **tempo sem interação**, **TMA**. Toggle no filtro decide se aplica.

### Rótulo automático (regra simples)
Por operador, no período:
- `Alto desempenho` — throughput acima da mediana **e** atraso médio abaixo da mediana **e** CSAT ≥ 4
- `Sobrecarregado` — top‑3 throughput **e** tempo sem interação acima da mediana
- `Subutilizado` — throughput < 50% da mediana **e** ociosidade > 40% do expediente
- `Atenção` — atraso de início ou % fechar sem msg acima da mediana
Sem IA, só pra orientar o gestor.

### Performance
- Buscar tudo no servidor numa única `createServerFn` cacheada por filtros (TanStack Query `staleTime: 30s`).
- Limitar período máximo a 90 dias na UI para não estourar memória.

---

## Não-objetivos
- Não substitui o painel `ai-manager/operator-performance.tsx` (que usa IA); este é determinístico, baseado em dados.
- Não altera a Central de Atendimento nem as configurações de SLA existentes.
- Sem mudanças de schema do banco (todos os dados já existem nas tabelas atuais).
