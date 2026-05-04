# Relatório de Desempenho de Operadores

Adicionar uma nova aba **"Desempenho"** dentro do módulo `/relatorios` (já existente), agindo como um painel de Customer Success com 5 seções, alimentado em tempo real pelos dados de `zapi_chats`/`zapi_messages` (Chat) e `service_tickets` (Atendimento), com filtro de categoria/origem.

## Onde será adicionado

- Rota: `src/routes/relatorios.tsx` — nova `TabsTrigger value="desempenho"` + `TabsContent` correspondente.
- Novo componente: `src/components/relatorios/operator-performance-tab.tsx` (mantém o arquivo principal enxuto).
- Reaproveita: `ReportFilters` (datas), `ReportKpiCard`, `exportToCSV`, `exportToPDF`, paleta `COLORS` e Recharts já configurados.

## Filtros do painel

No topo do painel (além do filtro de datas global já presente):

1. **Origem dos dados** (segmented control):
   - `Chat` → fonte `zapi_chats` + `zapi_messages`
   - `Atendimento` → fonte `service_tickets`
   - `Ambos` (consolidado, normalizando para "atendimento concluído")
2. **Setor** — dropdown carregado de `sectors` (mesmo padrão dos outros relatórios).
3. **Operador** — multi-select (opcional) usando `profiles`.
4. **Categoria de chamado** — dropdown construído a partir de:
   - `service_tickets.category` (distinct) e
   - `category_routing_rules.category_label`
   - Opções típicas: Liberação, Configuração, Suporte, Comercial, etc.

Os filtros se combinam com o intervalo de datas global e revalidam via TanStack Query a cada 10s (mesma cadência do restante do app — dados "em tempo real").

## Seções do relatório

### 1. Ranking de Operadores — TMPR (Tempo Médio de Primeira Resposta)

- **Cálculo (Chat)**: para cada `zapi_chats` no período, achar a primeira mensagem com `from_me=false` (cliente) e a primeira mensagem subsequente com `from_me=true AND is_whisper=false` enviada pelo operador (`sent_by_user_id`). TMPR = média desses deltas, agrupado por `sent_by_user_id`.
- **Cálculo (Atendimento)**: usar `service_tickets.created_at` → primeiro evento de resposta (mesma lógica via `chat_id` linkado quando existir; quando não houver chat, usar `attendance_event_logs` do `event_type='first_response'` se presente, senão marcar como N/A).
- **Visual**: tabela ordenada ASC + gráfico de barras horizontais (Recharts). Coluna: Operador, TMPR (mm:ss), # interações, # chats analisados.

### 2. Análise de Ociosidade — Espera > 10 min

- **Definição**: chamados em que o tempo entre uma mensagem do cliente e a próxima resposta do operador foi superior a 10 minutos (limite configurável no painel, default 10).
- **Métrica por operador**:
  - `Quantidade de chamados ociosos`
  - `Taxa de ociosidade` = ociosos / total atendidos no período (%)
  - `Tempo médio de ociosidade` (média dos deltas que ultrapassaram o limite)
- **Visual**: tabela ordenada DESC por taxa + barra empilhada (Ociosos vs Dentro do SLA).

### 3. Análise de Produtividade — Volume + TMA

- **Volume Concluído**:
  - Chat: `zapi_chats` com `status='resolvido'` (ou equivalente) no período por `assigned_to`.
  - Atendimento: `service_tickets` com `status='finalizado'` e `closed_at` no período por `assigned_to`.
- **TMA (Tempo Médio de Atendimento)**: média de `closed_at - created_at` (atendimento) ou `last_message_at - created_at` do chat resolvido.
- **Visual**: KPIs por operador + tabela "Operador / Volume / TMA / Resolvidos no 1º contato (quando houver dados)".

### 4. Gargalos por Setor / Categoria

- Agrupar `service_tickets` por `sector` e por `category` no período.
- Para cada grupo calcular: volume, TMA, % finalizado, idade média dos abertos.
- Identificar e destacar (badge "Gargalo") a categoria com maior TMA e a com maior % de chamados ainda abertos.
- **Visual**:
  - Gráfico de barras "TMA por categoria" (ordenado DESC).
  - Tabela "Setor / Categoria / Volume / TMA / Em aberto".

### 5. Plano de Ação Individual

- Selecionar automaticamente os 3 operadores com pior taxa de ociosidade (seção 2).
- Para cada um, exibir um card com:
  - Nome, foto/avatar (se disponível em `profiles`), métricas-chave.
  - **2 ações corretivas** sugeridas, escolhidas a partir de um catálogo curto (não usa IA — puramente determinístico para evitar custo e latência):
    - Se TMPR alto → "Habilitar notificações sonoras de novos chats" + "Revisar respostas rápidas para acelerar a primeira interação".
    - Se muitos chats simultâneos → "Limitar fila simultânea a N chats no horário de pico" + "Priorizar chats com SLA vermelho antes de novos".
    - Se TMA alto + ociosidade alta → "Bloquear janela de foco de 30 min sem novas atribuições" + "Encerrar conversas resolvidas para liberar capacidade".
    - Se ociosidade concentrada em determinado horário → "Ajustar pausa/almoço para fora do pico identificado" + "Transferir chats parados há mais de 10 min para colega disponível".
- Cada card tem botão **"Registrar plano"** que grava em `audit_logs` (`entity_type='operator_action_plan'`) para histórico.

## Exportação

Botões já existentes (CSV / XLSX / PDF) no header de Relatórios passam a exportar o conteúdo da aba ativa. Para a aba Desempenho:

- CSV/XLSX: uma linha por operador com todas as métricas das seções 1–3 + flag de gargalo da seção 4.
- PDF: snapshot visual da aba (já suportado por `exportToPDF`).

## Detalhes técnicos

- **Queries**: 3 novas `useQuery` em `operator-performance-tab.tsx`:
  1. `["perf-chats", dateFrom, dateTo, sector, category]` — chats + mensagens (paginar via `range` se >1000).
  2. `["perf-tickets", dateFrom, dateTo, sector, category]` — tickets do período com joins de `profiles` e `companies`.
  3. `["perf-operators"]` — `profiles` ativos.
- **`refetchInterval: 10_000`** para refletir tempo real (mesmo padrão de `useZapiRealtime`).
- **Cálculos** centralizados em `src/lib/operator-metrics.ts` (puro TS, sem dependência de servidor) — funções: `computeFirstResponseTimes`, `computeIdleness`, `computeProductivity`, `computeSectorBottlenecks`, `suggestActions`.
- **Tipos**: derivados de `Database` em `src/integrations/supabase/types.ts`.
- **Permissões**: aba visível apenas para `admin` e `gestor` (conferido por `has_role` no front, igual aos outros relatórios sensíveis).
- **Nada novo no backend**: nenhuma migration, nenhuma edge function, nenhuma alteração de RLS — tudo usa tabelas existentes.

## Fluxo de implementação

1. Criar `src/lib/operator-metrics.ts` com as funções de cálculo + testes manuais via console.
2. Criar `src/components/relatorios/operator-performance-tab.tsx` com filtros, KPIs, tabelas e gráficos.
3. Em `src/routes/relatorios.tsx`: adicionar nova `TabsTrigger` "Desempenho" e `TabsContent` que monta o componente, e estender `handleExport` para o novo `activeTab`.
4. Validar no preview com dados reais (filtros Chat/Atendimento, troca de categoria, exportações).
