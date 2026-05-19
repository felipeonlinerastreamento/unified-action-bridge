## Regra de reabertura

Quando um chat **finalizado** recebe nova mensagem do cliente:

| Tempo desde `closed_at` | Ação |
|---|---|
| **≤ 1 hora** | **Reabre o mesmo chamado** (UPDATE no `service_ticket` anterior: `status = 'reaberto'`, `reopened_at = now()`, `closed_at = null`, `closed_by = null`). Mantém o **mesmo `protocol_number`**. Chat volta a `em_atendimento`/`aguardando`. **Não roda o bot** (segue sem menu, como hoje). |
| **> 1 hora** | **Cria um novo `service_ticket`** (novo `protocol_number` via sequence). Chat reabre **rodando o fluxo do bot** normalmente (menu de setor), igual ao primeiro contato. |

A regra atual de `pending_resolve` ("A resolver" → mesmo protocolo, sem ticket novo) continua intacta.

## Mudança

Arquivo único: `src/routes/api.public.zapi-webhook.$channelId.tsx` (ramo de reabertura, ~linhas 855-882).

1. Calcular `withinOneHour = sinceCloseMs <= 60 * 60 * 1000` (a variável `sinceCloseMs` já existe na linha 789).
2. Buscar o último ticket finalizado do chat (já feito na linha 860). Selecionar `id, protocol_number, sector, sector_name` (na verdade só `sector` está na tabela — manter como hoje + `id`).
3. **Branch A — `withinOneHour && lastTicket`:**
   - `UPDATE service_tickets SET status='reaberto', reopened_at=now(), closed_at=null, closed_by=null WHERE id = lastTicket.id`.
   - Setor do chat herda `lastTicket.sector` ou o `sector_name` atual.
   - `baseUpdate.bot_state = {}`, atribui operador via `pickLeastLoadedAgent`, status `em_atendimento`/`aguardando`.
   - `justReopenedSilently = true` (mantém comportamento atual — **não executa o bot**, sem menu reenviado).
   - Log: `[zapi-webhook] reopening finalized chat within 1h → same ticket #PROTO reopened, no new protocol`.
4. **Branch B — `!withinOneHour` (ou sem ticket anterior):**
   - **Cria novo `service_ticket`** com:
     - `attendance_id = chatId`, `channel_id`, `contact_phone = phone`, `contact_name`, `status = 'aberto'`, `sector = lastTicket?.sector || sector_name || 'Atendimento'`, `notes = 'Reabertura após 1h do protocolo anterior #<lastProto>'` quando houver anterior.
     - `protocol_number` deixado em branco → o `DEFAULT nextval(...)` gera.
   - `baseUpdate.bot_state = {}`, status `aguardando` (ou `em_atendimento` se houver agente disponível — manter regra atual).
   - **NÃO** setar `justReopenedSilently = true` → o bloco do bot (linha 994) executa normalmente, mandando o menu inicial → novo fluxo de atendimento.
   - Log: `[zapi-webhook] reopening finalized chat after 1h → new ticket #NEWPROTO + bot flow restart`.

## Comportamento resultante

- Cliente envia nova msg até 1h após fechamento → mesmo protocolo, mesmo histórico, ticket sai de `finalizado` para `reaberto`, atendente assume direto.
- Cliente envia nova msg após >1h → novo protocolo (nova entrada em `service_tickets`), bot reapresenta menu de setor, cliente escolhe e o fluxo segue como atendimento novo.
- CSAT pendente do anterior continua intacto em ambos os casos (não é descartado pela reabertura).
- `pending_resolve` ("A resolver") segue exatamente como hoje.

## Fora de escopo

- Não tocar em CSAT, business hours, grupos, sectors UI.
- Não migrar tickets históricos (#01324, #01331, #01316, #01308 permanecem como estão).
- Sem mudança de schema/migrations — `service_ticket_status` já tem `'reaberto'` e `protocol_number` já tem default via sequence.
- Não alterar a UI de Central/Atendimentos (ticket reaberto já aparece corretamente pelo status existente).
