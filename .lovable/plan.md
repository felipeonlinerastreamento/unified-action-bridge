# Atividades do Chamado

## Visão geral
Criar um catálogo de "Atividades" gerenciável em **Configurações > Encaminhamento** e disponibilizá-las no detalhe do atendimento. Cada atividade adicionada a um chamado tem checkbox de conclusão + observação. O chamado só pode ser finalizado quando todas as atividades vinculadas estiverem concluídas. Cada ação no checkbox gera registro nos comentários do chamado.

## Banco de dados (migration)

1. **`ticket_activity_catalog`** — catálogo gerido pelo admin
   - `name` (text, obrigatório), `description` (text), `is_active` (bool default true), `created_by`
   - RLS: select para `authenticated`; insert/update/delete apenas para `admin`

2. **`ticket_activities`** — atividades vinculadas a um chamado
   - `ticket_id` (fk service_tickets, on delete cascade)
   - `catalog_id` (fk ticket_activity_catalog)
   - `name_snapshot`, `description_snapshot` (preservam nome/descrição no momento do add)
   - `is_completed` (bool default false), `completion_note` (text), `completed_at`, `completed_by`
   - `added_by`, `created_at`, `updated_at`
   - RLS:
     - select: qualquer autenticado que vê o ticket
     - insert: atendente/gestor/admin
     - update (marcar/desmarcar + nota): atendente/gestor/admin
     - delete: apenas `admin` (regra do usuário: "somente admin pode retirar")
   - Permite múltiplas atividades por chamado (sem unique).

## Configurações > Encaminhamento (UI de catálogo)

Em `src/routes/configuracoes.encaminhamento.tsx` adicionar nova aba/seção **"Atividades do chamado"** com:
- Lista das atividades existentes (nome + descrição + status ativo)
- Botão "Nova atividade" → dialog com campos **Nome** e **Descrição**
- Editar (admin) e Excluir/Desativar (admin)
- Componente novo: `src/components/configuracoes/ticket-activities-config.tsx`

## Detalhe do atendimento

Em `src/components/atendimentos/ticket-detail-panel.tsx`, criar uma nova seção **"Atividades"** (acima de Comentários ou em nova aba), implementada num componente próprio: `src/components/atendimentos/ticket-activities-section.tsx`.

Comportamento:
- Combobox para selecionar uma atividade do catálogo ativo + botão "Adicionar"
- Lista das atividades já vinculadas mostrando: nome, descrição, checkbox de conclusão, campo de observação, autor e data de conclusão
- Marcar/desmarcar checkbox:
  - Abre prompt de observação (textarea obrigatória opcional — manteremos opcional, com placeholder "Observação")
  - Atualiza `ticket_activities` (is_completed, completion_note, completed_at, completed_by)
  - Insere registro em `ticket_comments` com `comment_type: 'atividade'` no formato:
    - `✅ Atividade "<nome>" concluída — <observação>`
    - `↩️ Atividade "<nome>" reaberta — <observação>`
- Botão remover (lixeira) visível **apenas para admin**

## Bloqueio na finalização

Ajustar o fluxo de finalização (em `src/lib/ticket-finalize-flow.ts` e/ou nos handlers de finalização do `ticket-detail-panel.tsx` e `ticket-kanban-view.tsx`):
- Antes de finalizar, consultar `ticket_activities` do chamado
- Se existir alguma com `is_completed = false`, bloquear com toast: *"Conclua todas as atividades do chamado antes de finalizar."* e listar as pendentes
- Caso contrário, segue o fluxo atual de finalização

Importante: a regra anterior (TE, kanban arrastar para finalizado, botão "Sim, finalizar") permanece — apenas adicionamos a checagem das atividades como pré-requisito.

## Comentários

Adicionar `'atividade'` como valor reconhecido em `comment_type` na renderização da aba Comentários (ícone próprio, ex.: `CheckSquare`) em `getCommentIcon` dentro de `ticket-detail-panel.tsx`.

## Detalhes técnicos

- Sem alteração nas regras existentes de TE, encaminhamento, kanban, reminders.
- `ticket_activity_catalog` e `ticket_activities` recebem GRANT para `authenticated` + `service_role`.
- Trigger `update_updated_at_column` aplicado em ambas as tabelas.
- Realtime opcional na `ticket_activities` para refletir em painéis abertos (via `supabase.channel`).
- Permissões via `has_role(auth.uid(), 'admin')` para delete/edit no catálogo e delete em `ticket_activities`.

## Fora de escopo
- Relatórios sobre atividades, métricas, dashboards.
- Notificações push/email.
- Edição da observação após o checkbox confirmado (poderá ser feita reabrindo + reconcluindo).
