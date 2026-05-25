## Objetivo

Em tickets recorrentes, clicar em **Finalizar** não encerra o ticket: ele continua aberto e o lembrete avança para a próxima data. Tudo permanece no mesmo ticket (histórico único). Adicionalmente, exibir um badge **"Próxima notificação: dd/mm/aaaa hh:mm"** ao lado da prioridade na lista e no painel de detalhes.

## Comportamento atual (para referência)

- `ticket.is_recurring=true` exige uma observação no diálogo de finalização (`ticket-detail-panel.tsx` linhas 404–454).
- Hoje, mesmo recorrente, o ticket é marcado como `finalizado` via `finalizeTicketWithFlow` (encerra o ticket e fecha o chat vinculado).
- O trigger `handle_reminder_completion` já cria automaticamente o próximo `ticket_reminders` quando o atual é marcado `is_dismissed=true`, e espelha `service_tickets.reminder_date` para a próxima data.

## Mudança 1 — Recorrência reagenda em vez de finalizar

Arquivo: `src/components/atendimentos/ticket-detail-panel.tsx`, função `updateStatus` (linhas 401–455).

Quando `newStatus === "finalizado"` **e** `ticket.is_recurring === true`:

1. Validar observação obrigatória (já existe).
2. Buscar lembretes ativos recorrentes do ticket (já existe — linhas 412–418).
3. Para cada um, marcar `is_dismissed=true` com a observação como `completion_comment` (já existe — linhas 419–430). O trigger no banco cuida de criar o próximo `ticket_reminders` e atualizar `service_tickets.reminder_date`.
4. **Não** chamar `finalizeTicketWithFlow`. Em vez disso:
   - Manter o status do ticket inalterado (`aberto`/`em_andamento`/`reaberto`).
   - Atualizar `service_tickets.updated_at`.
   - Reler a `reminder_date` recém-gravada pelo trigger e inserir comentário do sistema:
     `"Ocorrência concluída e reagendada para <dd/mm/aaaa hh:mm>. Observação: <obs>"`.
5. Invalidar queries `ticket-reminders`, `ticket-reminder-history`, `service-tickets`, `ticket-comments`.
6. Toast: `"Ocorrência concluída — próxima notificação em <data>"`.

Ajustes visuais correlatos no mesmo arquivo:

- Botão **Finalizar** (linhas ~960–968): quando `ticket.is_recurring`, trocar rótulo para `"Concluir ocorrência"` e ícone permanece (`CheckCircle`). Mantém habilitado mesmo sem `canFinalize=false` apenas se status != finalizado (regra atual já cobre).
- Diálogo de confirmação (linhas ~1080–1110): quando `is_recurring`, título `"Concluir ocorrência?"` e descrição `"O ticket permanecerá aberto e a próxima notificação será criada automaticamente."`. O placeholder/label da observação continua igual.

Não há mudanças no fluxo padrão (não recorrente) — segue chamando `finalizeTicketWithFlow` como hoje.

## Mudança 2 — Badge "Próxima notificação"

Fonte: `service_tickets.reminder_date` (já é mantida pelo trigger e pelos forms de lembrete, ver `ticket-reminder-section.tsx` linhas 149–152).

a) **Lista de tickets** (`src/components/atendimentos/ticket-list-view.tsx`, linha 66): renderizar logo após `getPriorityBadge(...)` um novo badge apenas se `t.reminder_date`:

```tsx
{t.reminder_date && (
  <Badge variant="outline" className="text-xs gap-1 border-amber-500 text-amber-700 dark:text-amber-400">
    <Bell className="h-3 w-3" />
    Próxima notificação: {new Date(t.reminder_date).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
    })}
  </Badge>
)}
```

Importar `Bell` de `lucide-react`.

b) **Painel de detalhes** (`src/components/atendimentos/ticket-detail-panel.tsx`, header em volta da linha 694): adicionar o mesmo badge no `<div className="flex items-center gap-2 pt-1">` ao lado dos botões de ação, condicional a `ticket.reminder_date`.

Nenhuma alteração de schema; o campo `reminder_date` já vem nas queries existentes (`select *`).

## Fora de escopo

- Kanban (não foi pedido; o card já mostra apenas a bolinha de prioridade).
- Mudanças no `finalizeTicketWithFlow` ou no chat vinculado.
- Alterações no trigger `handle_reminder_completion` (já faz o reagendamento correto).
- Criação de tickets-filho — explicitamente confirmado pelo usuário ("tudo no mesmo ticket").

## Verificação

1. Abrir ticket recorrente #01587 → clicar "Concluir ocorrência" → preencher observação → confirmar.
2. Esperado: status permanece `aberto`/`reaberto`; `reminder_date` avança para a próxima data; comentário do sistema registra a observação e a nova data; badge na lista mostra a nova data.
3. Em ticket não recorrente, "Finalizar" segue encerrando normalmente.
