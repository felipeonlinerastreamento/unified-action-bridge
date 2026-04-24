## Objetivo

No menu **Atendimentos**, cada ticket (em todas as visualizações: Lista, Kanban e Calendário) deve mostrar de forma clara:
- **Data de criação** (já existe parcialmente, mas será padronizada com data + hora)
- **Data do último comentário/interação** (novo)

## Análise do estado atual

- A tela `AtendimentosContent` faz uma única query em `service_tickets` sem trazer comentários.
- A tabela `ticket_comments` armazena todas as interações (comentários, mudanças de status, encaminhamentos, etc.) com `created_at`.
- Hoje os cards mostram apenas `created_at` formatado como data (sem hora), e nada sobre a última interação.

## Plano de implementação

### 1. Buscar a data do último comentário junto com os tickets

Em `src/components/atendimentos/atendimentos-content.tsx`, na query `service-tickets`:
- Após carregar os tickets, fazer uma segunda query agregada em `ticket_comments` selecionando `ticket_id, created_at` ordenado desc, agrupando no client por `ticket_id` e pegando o `MAX(created_at)`.
- Mesclar o resultado em cada ticket como `last_comment_at`.
- Manter o `refetchInterval: 30000` para atualizar automaticamente.

Alternativa mais eficiente (sem alterar schema): aproveitar que toda mudança relevante já chama `update_at` do ticket — porém o `updated_at` muda também por edições silenciosas. A query separada de comentários é mais precisa para "última interação real" e é o que o usuário pediu.

### 2. Atualizar `TicketListView`

Em `src/components/atendimentos/ticket-list-view.tsx`:
- Substituir o `created_at` formatado apenas como data por **"Criado em: dd/MM/yyyy HH:mm"**.
- Adicionar nova linha/badge com **"Último comentário: dd/MM/yyyy HH:mm"** (ou "Sem comentários" quando nulo), com ícone `MessageSquare`.
- Usar `formatDistanceToNow` do `date-fns` em tooltip para mostrar "há X minutos/horas" ao passar o mouse.

### 3. Atualizar `TicketKanbanView`

Em `src/components/atendimentos/ticket-kanban-view.tsx`:
- No card de cada ticket, manter o `Clock` com `created_at` (data + hora curta).
- Adicionar uma linha extra com ícone `MessageSquare` e a data/hora do último comentário (ou "—" quando vazio).

### 4. Atualizar `TicketCalendarView`

Em `src/components/atendimentos/ticket-calendar-view.tsx`:
- Nos cards da lista lateral (tickets do dia selecionado), adicionar a data do último comentário em texto pequeno abaixo do setor.

### 5. Formatação consistente

Criar utilitário inline (ou usar `date-fns/format`):
- Formato curto: `dd/MM HH:mm` quando do mesmo ano.
- Formato completo: `dd/MM/yyyy HH:mm` caso contrário.
- Se `last_comment_at` for nulo, exibir `"Sem interações"`.

## Arquivos que serão editados

- `src/components/atendimentos/atendimentos-content.tsx` — adicionar query de últimos comentários e mesclar em cada ticket.
- `src/components/atendimentos/ticket-list-view.tsx` — exibir criação (com hora) + último comentário.
- `src/components/atendimentos/ticket-kanban-view.tsx` — exibir último comentário no card.
- `src/components/atendimentos/ticket-calendar-view.tsx` — exibir último comentário nos cards laterais.

## Sem alterações no banco

Não há necessidade de migração: a coluna `ticket_comments.created_at` já existe e é alimentada por todas as ações relevantes do sistema (status, encaminhamento, edição de categoria, lembretes, etc.).

Aprove o plano para eu implementar.