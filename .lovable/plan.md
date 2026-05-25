Duas mudanças relacionadas à recorrência de lembretes nos tickets.

## 1. Corrigir cálculo do reagendamento

**Problema**: Hoje (25/05) você finalizou o lembrete recorrente semanal do ticket #01587, que estava agendado para 08/06. O trigger `handle_reminder_completion` calcula o próximo somando o intervalo a partir de `reminder_date` (08/06 + 7 = 15/06), ignorando a data real da conclusão. Por isso pulou 01/06.

**Correção** (migration em `handle_reminder_completion`):
- Calcular `v_next_date` a partir de `now()` (data da conclusão), não de `NEW.reminder_date`.
- Para `weekly`/`biweekly`: somar o intervalo e depois ajustar para o mesmo dia da semana do `reminder_date` original (preserva "toda segunda").
- Preservar a hora original (`EXTRACT(hour/minute FROM NEW.reminder_date)`).
- Para `monthly`/`yearly`: somar a partir de `now()` mantendo o dia/hora original quando possível.
- `daily` continua `now() + 1 day` na mesma hora.

Resultado para #01587: finalizado hoje (segunda 25/05) → próximo = próxima segunda = **01/06** na mesma hora (11:30).

## 2. Editar e excluir recorrência no ticket

Em `src/components/atendimentos/ticket-reminder-section.tsx`, no card de cada lembrete ativo recorrente, adicionar dois botões além do "Finalizar":

- **Editar** (ícone `Pencil`): abre um mini-form inline preenchido com `reminder_date`, `reminder_note`, `recurrence_type`, `recurrence_end_date` e a hora. Ao salvar, faz `UPDATE` em `ticket_reminders` e espelha `reminder_date`/`reminder_note` em `service_tickets`. Adiciona comentário de sistema "Recorrência alterada...".
- **Excluir recorrência** (ícone `Trash2`, com `AlertDialog`): duas opções no diálogo:
  - "Manter como lembrete único" → `UPDATE` zera `recurrence_type` e `recurrence_end_date` (lembrete continua, mas não reagenda).
  - "Remover lembrete" → `DELETE` da row e limpa `reminder_date`/`reminder_note` em `service_tickets`.
  - Comentário de sistema correspondente em `ticket_comments`.

Sem alterações no schema (todos os campos já existem). Sem mudanças no fluxo de finalização do ticket (lógica de "Concluir ocorrência" do detail panel permanece igual e passará a se beneficiar do cálculo corrigido).

## Verificação
- Finalizar lembrete recorrente semanal fora da data: novo `ticket_reminders` cai na próxima ocorrência do mesmo dia da semana após hoje.
- Editar recorrência: atualiza a row ativa e o badge "Próxima notificação" no ticket.
- Excluir > "Manter como único": badge continua, sem reagendar ao finalizar.
- Excluir > "Remover": some o lembrete e o badge no ticket.
