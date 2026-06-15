## Nova aba "Jornada & Ociosidade" em Relatórios

Adiciona um relatório por operador com duas seções: jornada do dia (presença) e tempo ocioso de chats.

### 1. Jornada do dia (por operador)

Fonte: `audit_logs` (categoria `presence`, eventos `set_online` / `set_offline`).

Por dia + operador, calcular:
- **Início**: primeiro `set_online` do dia
- **Fim**: último `set_offline` do dia (se ainda online, mostra "em atividade")
- **Tempo total online**: soma das janelas `online → offline` no dia
- **Nº de pausas**: quantidade de ciclos online/offline

Tabela: Operador | Data | Início | Fim | Tempo online | Pausas | Status.

### 2. Ociosidade de chats (>N min)

Definição: período em que o chat estava `em_atendimento`, atribuído ao operador, e o **operador não enviou mensagem** por mais de N minutos (padrão 10, configurável no filtro).

Fonte: `zapi_messages` (com `from_me=true` / sender = operador) cruzado com `zapi_chats` para saber atribuição e status.

Algoritmo (por operador, no período):
1. Listar chats atribuídos ao operador que estiveram em atendimento.
2. Para cada chat, ordenar mensagens do operador por tempo.
3. Calcular gaps entre mensagens consecutivas do operador (e gap final até `closed_at`/agora).
4. Somar apenas gaps `> N min`.

Saídas:
- **KPI**: total de tempo ocioso e nº de ocorrências no período/operador.
- **Gráfico de barras** (Recharts): tempo ocioso por operador.
- **Gráfico de linha**: tempo ocioso por dia.
- **Tabela detalhada**: Operador | Chat | Contato | Início do gap | Fim do gap | Duração.

### Filtros (topo da aba)
- Período (data início/fim, padrão últimos 7 dias)
- Operador (multi-select, padrão "Todos")
- Limite de ociosidade em minutos (input numérico, padrão 10)
- Botão Exportar CSV

### Arquivos

- `src/lib/operator-journey.functions.ts` (novo) — 2 server functions:
  - `getOperatorJourney({ from, to, userIds })` → jornada diária
  - `getChatIdleness({ from, to, userIds, thresholdMinutes })` → ociosidade
  - Ambas com `requireSupabaseAuth` + checagem `has_role` (admin/gestor).
- `src/components/relatorios/operator-journey-tab.tsx` (novo) — UI da aba, usa TanStack Query + Recharts.
- `src/routes/relatorios.tsx` (editar) — registrar nova aba "Jornada & Ociosidade".

### Permissão
Apenas admin/gestor (mesmo padrão dos outros relatórios).

### Notas técnicas
- Datas em timezone do navegador; agregação por dia local.
- Limitar `zapi_messages` a janela do filtro com índice em `(chat_id, timestamp)` (já existe).
- Paginação interna nas queries (1000 linhas/batch) para evitar limite do PostgREST.