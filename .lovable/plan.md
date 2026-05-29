## Diagnóstico

A Lucia tem **dois chats em aberto**:

| Chat | `phone` | Mensagens | Origem |
|---|---|---|---|
| `6d0a17…c22e42` | `5531991342038` (real) | 10 | mensagens normais |
| `7f677f…b962644` | `51754490179771` (LID — 14 dígitos) | 5 | evento de chamada |

Quando o cliente tentou ligar, o Z-API enviou um identificador "LID" (linked id usado pelo WhatsApp para chamadas/privacidade) com **14 dígitos**. O webhook detecta LID apenas quando `phone.length >= 15` (`src/routes/api.public.zapi-webhook.$channelId.tsx` linhas 322 e 746, e função SQL `normalize_zapi_phone`). Como o LID tinha 14 dígitos, escapou da detecção, foi tratado como telefone normal e criou um novo chat em vez de mesclar no existente.

Telefones brasileiros têm no máximo 13 dígitos (`55` + DDD + 9 + 8). Qualquer identificador de 14+ dígitos não-grupo é, na prática, um LID.

## Plano

### 1. Webhook — `src/routes/api.public.zapi-webhook.$channelId.tsx`
- Em `normalizeIncomingPhone` (linha 74), capturar a presença de `@lid` (sufixo) ou `lid:` (prefixo) **antes** de remover não-dígitos, e propagar essa informação para o chamador.
- Baixar o limiar de detecção de LID de `>= 15` para `>= 14` dígitos nos dois pontos:
  - Event de chamada (linha 322): `const isLidIdentifier = !isGroup && (rawHadLidMarker || phoneN.length >= 14);`
  - Event de mensagem (linha 746): mesma lógica.
- Garantir que `replyPhone` para LID continue usando `${phoneN}@lid` quando não houver chat real (linha 356).

### 2. Função SQL `normalize_zapi_phone` (migração)
- Trocar `length(digits) >= 15` por `length(digits) >= 14` para que novos chats com LID curto entrem no banco com prefixo `lid:` no `phone_normalized`. Isso mantém as queries existentes (`.not("phone_normalized", "like", "lid:%")`) funcionando como filtro.

### 3. Mesclar o chat duplicado da Lucia (migração de dados)
- Atualizar as 5 mensagens de `7f677f…b962644` para `chat_id = 6d0a17…c22e42`.
- Recalcular `last_message_at` e `last_message_preview` no chat real.
- Marcar o chat LID como `status = 'finalizado'`, `closed_at = now()` e gravar `lid_aliases` com `51754490179771` no chat real (para que futuros eventos com esse mesmo LID sejam reconhecidos via os lookups existentes nas linhas 327–335).

### 4. Sem mudanças em UI/lógica de tickets
O fluxo de atendimento, KPIs, fila e finalização permanecem intactos — só o roteamento do evento de chamada é corrigido.

## Risco / validação
- Telefones internacionais de 14 dígitos (fora do BR) ficariam classificados como LID. Hoje o sistema é BR-only, mas vale registrar. Caso apareça, o fallback por `contact_name` (linha 338–347) ainda permite mesclar; sem chat anterior, o evento é apenas dropado com log.
- Após aplicar, verificar nos logs `[zapi-webhook] LID-only ...` para garantir que nenhum chat legítimo está sendo dropado.
