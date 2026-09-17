# Deixar o menu Atendimentos rápido

## O que está acontecendo hoje

Ao abrir Atendimentos, o sistema baixa **todos os 7.214 atendimentos de todos os tempos**, com todas as colunas, e só depois aplica o filtro na tela. Além disso, faz cerca de **110 consultas em sequência** ao banco (comentários, responsáveis, lembretes, itens de liberação, suprimento, compras) antes de mostrar qualquer coisa. Por isso a primeira abertura demora tanto — e isso se repete sozinho a cada 30 segundos.

## Como vai ficar

1. **Carregar só o período recente por padrão**: últimos 90 dias + todos os atendimentos ainda abertos/em andamento (independente da idade). Isso passa de 7.214 para cerca de 4.600 registros já de saída, e tende a cair muito mais nos casos reais.
2. **Novo seletor "Período" nos filtros**: 30 dias, 90 dias (padrão), 6 meses, 1 ano e "Todo o histórico". Ao escolher um período maior, o sistema busca os dados mais antigos sob demanda, mantendo a tela visível enquanto atualiza.
3. **Buscar só o que a lista usa**: em vez de trazer todas as colunas de cada atendimento, trazer apenas as usadas na lista, nos cartões e nos filtros. O detalhe completo continua carregando ao abrir o atendimento.
4. **Menos idas ao banco**: as consultas de comentários, responsáveis e lembretes deixam de ser fatiadas em dezenas de chamadas e passam a ser uma chamada cada, feitas em paralelo com as demais. De ~110 chamadas para cerca de 8.
5. **Atualização automática menos agressiva**: passa de 30 para 60 segundos e não recarrega tudo ao voltar para a aba, evitando travadas durante o uso.
6. **Índices no banco** para as buscas por data e por atendimento, que hoje não existem.

Nada muda no que você vê: mesmos filtros, KPIs, Lista/Kanban/Calendário e painel de detalhes. O que muda é a velocidade, e o aviso de que a tela mostra um período — com o filtro para ver o histórico completo quando precisar.

## Detalhes técnicos

- `src/components/atendimentos/atendimentos-content.tsx`:
  - `queryKey: ["service-tickets", periodDays]`; consulta com `.or("created_at.gte.<cutoff>,status.in.(aberto,em_andamento,reaberto)")`, mantendo a paginação de 1000 em 1000.
  - Trocar `select("*")` por lista explícita de colunas + `companies(name)` + `ticket_tracking(...)`.
  - Remover `chunkedIn` para `ticket_comments` (usar `select("ticket_id, created_at").gte("created_at", cutoff)` e reduzir para o máximo por ticket), `ticket_agents` e `ticket_reminders` (tabelas pequenas, leitura única).
  - Disparar todas as consultas auxiliares com `Promise.all`.
  - `refetchInterval: 60000`, `refetchOnWindowFocus: false`, `placeholderData: keepPreviousData`.
- `src/components/atendimentos/ticket-filters.tsx`: novo campo `periodDays: number | null` em `TicketFilters` e `defaultFilters` (90), `Select` "Período" na barra de filtros, contando como filtro ativo quando diferente do padrão; `applyTicketFilters` não muda (o corte é no servidor).
- Migration: `CREATE INDEX idx_service_tickets_created_at ON public.service_tickets (created_at DESC)`, `CREATE INDEX idx_service_tickets_status_created_at ON public.service_tickets (status, created_at DESC)`, `CREATE INDEX idx_ticket_comments_ticket_created ON public.ticket_comments (ticket_id, created_at DESC)`.
- Verificação: medir o tempo de abertura antes/depois no preview e conferir que a contagem de KPIs com "Todo o histórico" bate com a atual.
