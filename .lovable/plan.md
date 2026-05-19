## Objetivo
Quando o cliente reinteragir após um chamado finalizado **sem CSAT respondido**, o sistema deve apenas **reabrir o chat** (assumir o operador, voltar para `em_atendimento`/`aguardando`) — **sem criar um novo `service_ticket` nem gerar novo protocolo**.

## Mudança

Arquivo: `src/routes/api.public.zapi-webhook.$channelId.tsx`

No ramo de reabertura de chat finalizado (linha ~890), remover a criação do novo ticket. O lookup do `lastTicket` deixa de ser necessário (era usado só para a nota do novo chamado), mas mantemos a leitura do `sector` do último ticket para definir o setor da reabertura.

Mudanças pontuais:
1. **Remover** a chamada `await ensureOpenTicketForChat({ ... reopenedFromProtocol: ... })` (linhas ~914-923).
2. **Manter** a query `lastTicket` apenas para obter `sector` (fallback do setor da reabertura). Pode reduzir o select para `select("sector")`.
3. **Remover** (ou marcar como dead-code e deletar) a função `ensureOpenTicketForChat` e seu parâmetro `reopenedFromProtocol`, pois esse era o único call-site. Confirmado via grep — nenhum outro uso.
4. Adicionar um `console.log` claro: `"[zapi-webhook] reopening finalized chat without CSAT → no new ticket/protocol will be created"`.

## Comportamento resultante

- Chat finalizado recebe nova mensagem do cliente → status volta a `em_atendimento` (ou `aguardando` se não houver operador online), atribuído ao operador menos carregado do setor anterior.
- **Nenhum service_ticket novo é criado**, nenhum protocolo novo é gerado.
- O CSAT anterior pendente continua intacto.
- O ramo de `pending_resolve` ("A resolver") continua exatamente como hoje (já não criava ticket novo).

## Fora de escopo

- Não alterar UI / configurações.
- Não tocar em CSAT, sectors, atribuição ou demais regras de reabertura.
- Não migrar dados históricos (chamados como #01245 permanecem como estão).
