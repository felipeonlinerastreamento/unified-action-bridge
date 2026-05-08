## Problema
Mensagens enviadas pelos operadores via sistema são gravadas corretamente com `from_me=true`, mas o webhook da Z-API depois sobrescreve para `from_me=false`, fazendo elas aparecerem do lado esquerdo do chat (como se fossem do cliente). Confirmado nos dados de `553184049398`: linhas com `sent_by_user_id` setado e `from_me=false`.

## Causa raiz
1. `sendText` insere a mensagem com `from_me: true` + `sent_by_user_id` + `zapi_message_id` retornado pela Z-API.
2. A Z-API envia um eco do envio como `ReceivedCallback` com `fromMe=true` (acontece quando o número/conta conectada aparece como sender em sincronizações de dispositivo).
3. `api.public.zapi-webhook.$channelId.tsx` linhas 202-210 força `effectiveFromMe = false` para qualquer `ReceivedCallback`, ignorando o `fromMe` do payload.
4. `persistZapiMessage` localiza a linha existente pelo `zapi_message_id`, dá `UPDATE` com `from_me: false, status: "delivered"` e destrói a marcação correta.

## Correção
Em `src/routes/api.public.zapi-webhook.$channelId.tsx`, ajustar `persistZapiMessage` para que, ao encontrar uma linha pré-existente (mesmo `chat_id` + `zapi_message_id`), **nunca rebaixe `from_me=true` para `false` nem sobrescreva `sent_by_user_id`**. A linha já existe porque foi inserida pelo `sendText` do operador — o webhook deve apenas confirmar entrega, não reclassificar a direção.

Mudança concreta na função `persistZapiMessage` (linhas 602-646):

- Buscar a linha existente trazendo também `from_me, sent_by_user_id`.
- Se já existir e `from_me=true` (ou `sent_by_user_id` não nulo), montar um update **apenas com campos seguros**: `status`, `media_url`, `media_type`, `participant_name`, `participant_phone` — preservando `from_me` e `sent_by_user_id`.
- Se a linha existente é genuinamente do cliente (`from_me=false` e `sent_by_user_id` nulo), manter o comportamento atual.
- Para o `INSERT` novo (linha não existe), nada muda.

Opcionalmente, no bloco 196-210 onde calculamos `effectiveFromMe`, adicionar comentário explicando que essa proteção secundária no `persistZapiMessage` é o que evita corrupção de mensagens do operador. Não vou tocar na regra do `effectiveFromMe` porque ela ainda é necessária para o caso original (cliente cujo número coincide com a conta — evitar que mensagens REAIS do cliente sejam salvas como `from_me=true`).

## Backfill das mensagens já corrompidas
Migration única para corrigir o histórico:
```sql
UPDATE public.zapi_messages
SET from_me = true,
    status = CASE WHEN status = 'delivered' THEN 'sent' ELSE status END
WHERE from_me = false
  AND sent_by_user_id IS NOT NULL;
```
Critério seguro: `sent_by_user_id` só é preenchido pelo fluxo de envio do operador; se está setado, a mensagem é necessariamente outbound.

## Validação
1. Operador envia mensagem teste pelo sistema → aparece imediatamente à direita e **continua à direita** após o webhook processar (verificar no DB que `from_me` permanece `true`).
2. Cliente envia mensagem → continua à esquerda, `from_me=false`, `sent_by_user_id=null`.
3. Rodar `SELECT COUNT(*) FROM zapi_messages WHERE from_me=false AND sent_by_user_id IS NOT NULL` → deve retornar 0 após o backfill.
4. Conferir no chat `553184049398` que as respostas de Davi e Fernanda voltam para o lado direito.

## Arquivos
- `src/routes/api.public.zapi-webhook.$channelId.tsx` — ajustar `persistZapiMessage`.
- `supabase/migrations/<nova>.sql` — backfill das linhas existentes.
