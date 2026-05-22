## Problema

O protocolo #01396 foi criado automaticamente quando uma nova mensagem chegou após o protocolo anterior (#1301) ser finalizado. Isso viola a regra: **protocolo deve ser gerado apenas na finalização do chat**, não ao reabrir um chat por nova mensagem.

## Causa

Em `src/routes/api.public.zapi-webhook.$channelId.tsx` (linhas 855–900), no ramo de reabertura "não pending-resolve" (mensagem nova depois de finalizado), o webhook faz `insert` em `service_tickets` imediatamente, criando um ticket "aberto" sem categoria — exatamente o que apareceu no #01396 (sem categoria, nota "Nova mensagem após finalização do protocolo anterior #1301").

## Ajuste

No webhook, no bloco `else` que trata reabertura por nova mensagem (linhas ~855–900):

1. **Remover** o `insert` em `service_tickets` (linhas 878–898).
2. **Manter** a reabertura do `zapi_chats` (mudar status para `em_atendimento`/`aguardando`, limpar `bot_state`, atribuir operador via least-loaded) — o chat volta para fila normalmente e o bot reapresenta menu.
3. O ticket/protocolo passará a ser criado somente quando o operador finalizar o atendimento (fluxo já existente em `central.tsx` na finalização e no helper `resolveGroupTicketStart`).

Demais ramos permanecem inalterados:
- **Pending-resolve** ("A resolver"): continua mantendo o mesmo ticket aberto (já correto).
- **Primeira mensagem de um chat novo**: já não cria ticket no webhook — segue o fluxo normal.

## Arquivos afetados

- `src/routes/api.public.zapi-webhook.$channelId.tsx` — remover o `insert` de `service_tickets` no reopen e ajustar log/comentário.

## Validação

- Enviar nova mensagem em chat previamente finalizado → chat reabre na fila mas **nenhum** ticket novo aparece em `service_tickets` até o operador clicar em Finalizar.
- Ticket #1301-like: ao finalizar o novo atendimento, o protocolo é criado nesse momento, com categoria/dados preenchidos pelo operador.
