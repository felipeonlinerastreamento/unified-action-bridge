

# Plano: Gestão Completa de Tickets de Atendimento

## Resumo
Transformar a tela de Atendimentos em um sistema completo de gestão de tickets com visualizações Kanban e Calendário, comentários, encaminhamento entre setores/usuários, finalização e reabertura.

## O que será feito

### 1. Evolução do Schema (Migração SQL)

**Novas tabelas:**
- `ticket_comments` — comentários/histórico do ticket
  - `id`, `ticket_id` (FK service_tickets), `user_id`, `content`, `type` (comentario|encaminhamento|status_change|sistema), `created_at`
  - RLS: autenticados leem e criam

- `ticket_assignments` — responsáveis pelo ticket
  - `id`, `ticket_id`, `assigned_to` (user_id), `assigned_by`, `sector_name`, `created_at`
  - RLS: autenticados gerenciam

**Alterações em `service_tickets`:**
- Adicionar coluna `priority` (enum: baixa, media, alta, urgente, default media)
- Adicionar coluna `category` (text, nullable)
- Adicionar coluna `assigned_to` (uuid, nullable — usuário responsável atual)
- Adicionar coluna `sector` (text, nullable — setor atual)
- Adicionar coluna `reopened_at` (timestamptz, nullable)
- Adicionar novo valor ao enum `service_ticket_status`: `reaberto`

### 2. Componentes de Visualização

**`src/components/atendimentos/ticket-kanban-view.tsx`**
- Colunas: Aberto → Em Andamento → Finalizado (+ Reaberto)
- Drag-and-drop entre colunas atualiza status
- Card compacto com nome, cliente, prioridade, responsável, SLA

**`src/components/atendimentos/ticket-calendar-view.tsx`**
- Calendário mensal mostrando tickets por data de criação
- Click no dia abre lista dos tickets daquele dia
- Indicadores visuais de status por cor

**`src/components/atendimentos/ticket-list-view.tsx`**
- Refatoração da listagem atual (cards) como componente separado

**`src/components/atendimentos/ticket-detail-panel.tsx`**
- Painel lateral (Sheet) ao clicar em um ticket
- Abas: Detalhes | Comentários | Histórico
- Ações: Finalizar, Reabrir, Encaminhar (setor/usuário), Alterar Prioridade
- Timeline de comentários com tipo (comentário, encaminhamento, mudança de status)
- Campo para adicionar comentário

### 3. Refatoração da Página Principal

**`src/components/atendimentos/atendimentos-content.tsx`**
- Tabs de visualização: Lista | Kanban | Calendário (além das tabs existentes de fonte)
- KPIs no topo: Total Abertos, Em Andamento, Finalizados Hoje, Tempo Médio
- Botão "Novo Ticket" para criação manual

### 4. Ações nos Tickets

- **Finalizar**: Muda status para `finalizado`, registra `closed_at`, cria comentário automático
- **Reabrir**: Muda status para `reaberto`, limpa `closed_at`, registra `reopened_at`, cria comentário
- **Encaminhar para Setor**: Atualiza `sector`, cria comentário tipo `encaminhamento`
- **Encaminhar para Usuário**: Atualiza `assigned_to`, cria comentário tipo `encaminhamento`
- **Comentar**: Insere em `ticket_comments` com tipo `comentario`

### 5. Sugestoes Adicionais Incluídas

- **Prioridade visual** (cores: verde/amarelo/laranja/vermelho)
- **KPIs resumo** no topo da página
- **Filtro por responsável** e por prioridade
- **Histórico/timeline** completo de cada ticket (quem fez o quê e quando)
- **Criação manual de ticket** (não apenas automática pela Central)

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | SQL: enum priority, colunas em service_tickets, tabelas ticket_comments e ticket_assignments |
| Criar | `src/components/atendimentos/ticket-kanban-view.tsx` |
| Criar | `src/components/atendimentos/ticket-calendar-view.tsx` |
| Criar | `src/components/atendimentos/ticket-list-view.tsx` |
| Criar | `src/components/atendimentos/ticket-detail-panel.tsx` |
| Criar | `src/components/atendimentos/ticket-kpis.tsx` |
| Criar | `src/components/atendimentos/ticket-create-dialog.tsx` |
| Editar | `src/components/atendimentos/atendimentos-content.tsx` — reestruturar com visualizações |
| Editar | `src/components/atendimentos/atendimentos-filters.tsx` — adicionar filtros de prioridade e responsável |

