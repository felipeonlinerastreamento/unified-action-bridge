## Objetivo

Mostrar nos detalhes do atendimento, junto com "Criado por", uma nova linha **"Finalizado por"** indicando o usuário que finalizou o chamado.

## O que será feito

1. **Banco de dados**
   - Adicionar coluna `closed_by` (uuid) na tabela `service_tickets`.
   - Preencher retroativamente, quando possível, usando o `closed_by_user_id` do `zapi_chats` vinculado (mesmo `attendance_id`).

2. **Gravação automática ao finalizar**
   Em todos os pontos onde um ticket vira `finalizado`, gravar `closed_by = usuário atual`:
   - `src/lib/ticket-finalize-flow.ts` (finalização padrão e bypass admin).
   - `src/routes/central.tsx` (finalização vinda do chat e fallback).
   - `src/components/atendimentos/ticket-kanban-view.tsx` (drag para "Finalizado").
   - `src/components/atendimentos/ticket-detail-panel.tsx` (mudança manual de status).

3. **UI – Detalhes do atendimento**
   Em `src/components/atendimentos/ticket-detail-panel.tsx`, logo abaixo de "Criado por", adicionar:
   ```
   Finalizado por: <nome do usuário>
   ```
   - Resolvido via lookup em `profiles` (mesmo padrão usado em "Criado por").
   - Só aparece quando o ticket está finalizado e tem `closed_by`.

## Fora do escopo

- Não altera relatórios, exports, kanban ou listas. Apenas o painel de detalhes.
- Não cria histórico de "quem finalizou cada vez" (somente o último).
