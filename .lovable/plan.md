## Contexto

Hoje a citação (reply) já está implementada ponta a ponta:

- UI (`src/routes/central.tsx`): badge "Respondendo a…" + envio com `replyToMessageId`.
- Server fn `sendText` (`src/lib/zapi.functions.ts`): busca a mensagem original, resolve `zapi_message_id`, persiste snapshot (`reply_to_text` / `reply_to_author`) e chama `zapiSendText(..., { messageId })`.
- Cliente Z-API (`src/lib/zapi.server.ts`): envia `payload.messageId` no `/send-text`.

Mesmo assim você relata que "marcações em mensagens anteriores não estão funcionando". Investigação rápida no banco:

- 837 mensagens `from_me=true` (não‑sussurro) sem `zapi_message_id` nos últimos 30 dias → todas são automatismos (boas-vindas, fora‑de‑horário, menu do bot, etc., `sent_by_user_id IS NULL`).
- Citar essas mensagens é **impossível** porque não temos o ID Z-API original — o servidor envia a mensagem normalmente, mas sem o campo `messageId`, então no WhatsApp do cliente ela chega solta. Mensagens recebidas e mensagens enviadas por operadores têm o ID corretamente.

Provável causa do sintoma: tentativa de citar essas mensagens automáticas (ou alguma outra sem `zapi_message_id`), e/ou outra falha intermediária que precisa ser confirmada por log.

## O que vou fazer

### 1. Instrumentar logs no envio com citação
Em `sendText` (`src/lib/zapi.functions.ts`), logar em cada chamada com `replyToMessageId`:

- `replyToMessageId` (uuid local) recebido,
- se a mensagem original foi encontrada,
- `zapi_message_id` resolvido (ou `null`),
- `messageId` final mandado ao Z-API,
- resposta do Z-API (status + corpo resumido).

E em `zapiSendText` (`src/lib/zapi.server.ts`), logar o payload enviado quando `messageId` estiver presente. Isso permite, na próxima reprodução, confirmar exatamente onde quebra.

### 2. Bloquear reply impossível com aviso claro
Quando o operador clicar em "Responder" sobre uma mensagem cujo `zapi_message_id` é `null` (tipicamente respostas automáticas), o frontend já tem essa info via `getChatMessages`. Vou:

- desabilitar a opção de responder nessas mensagens, ou
- mostrar toast: "Não é possível citar esta mensagem (gerada automaticamente sem ID do WhatsApp)."

Assim o operador para de tentar e não recebe envio "sem citação" silencioso.

### 3. Validar consistência chat × mensagem citada
O Z-API exige que `messageId` pertença ao mesmo `phone` do envio. Como recentemente normalizamos números BR (inserção do "9") e fizemos merge de chats duplicados, é possível que mensagens antigas tenham ficado com `chat_id` apontando ao chat consolidado, mas o `zapi_message_id` foi gerado num contexto onde o número estava em outro formato. Vou:

- na resolução do reply em `sendText`, garantir que a mensagem original pertence ao mesmo `chat_id` informado;
- se não pertencer, ignorar a citação (mas registrar log) para evitar 4xx do Z-API.

### 4. Reproduzir e confirmar fix
Após (1)–(3), peço para você reproduzir uma vez. Com os novos logs eu confirmo se:
- (a) o problema era citar mensagens automáticas → resolvido pelo bloqueio do passo 2, ou
- (b) o Z-API está rejeitando o `messageId` → ajusto o nome/forma do parâmetro (alguns endpoints aceitam `messageId` e outros `quoted` — vou confirmar pela resposta real do servidor).

## Arquivos afetados

- `src/lib/zapi.functions.ts` — logs + checagem de `chat_id` na origem do reply.
- `src/lib/zapi.server.ts` — logs no payload do `/send-text`.
- `src/routes/central.tsx` — desabilitar/avisar quando `zapi_message_id` da mensagem alvo for nulo. Possivelmente também `src/components/central/floating-chat-window.tsx` se a mesma UI existir lá.

Sem mudanças de schema ou migrations.

## Antes de implementar

Para fechar o diagnóstico mais rápido, me confirma só o sintoma exato (qualquer dos abaixo serve):
- aparece a tarja "Respondendo a…" no input mas no celular do cliente chega sem citação?
- o botão de responder não abre nada?
- só falha quando a mensagem alvo é antiga?

Se preferir, posso implementar o plano acima já — ele cobre todos esses cenários.
