# Correção: chamadas detectadas mas mensagem não enviada + mensagens normais sendo marcadas como "call"

## Diagnóstico (achei dois bugs sérios)

### Bug 1 — Detecção de chamada está pegando mensagens normais
Em `api.public.zapi-webhook.$channelId.tsx` linhas 233–244, ampliamos `isCallEvent` com:

```ts
/call/i.test(eventType)
```

Isso casa com `"SentCallback"`, `"ReceivedCallback"`, `"MessageStatusCallback"`, etc. — porque a substring "Call" aparece em "**Call**back". Resultado:

- Várias mensagens normais (CSAT, áudios, "Obrigada", "[áudio]") foram salvas com `media_type='call'` (vide `zapi_messages` últimos 30 min).
- Como a primeira condição que casa entra no `if (isCallEvent)` e dá `return` no fim, mensagens reais deixam de seguir o fluxo normal — bot, atribuição, triggers, etc.

### Bug 2 — Auto-rejeição não envia mensagem
O fluxo atual confia 100% no `/update-call-reject-message` da Z-API para enviar a mensagem automática. Se essa configuração não estiver ativa no instance, nada é enviado. Hoje **não enviamos a mensagem nós mesmos** quando detectamos a chamada.

## Plano

### 1. Restringir `isCallEvent` (sem regredir mensagens reais)
Trocar a regra atual por:

```ts
const isCallEvent =
  notification.startsWith("CALL_") ||
  eventType === "CallReceivedCallback" ||
  eventType === "CallReceivedNotificationCallback" ||
  // payload sem type reconhecido como mensagem, sem conteúdo, mas com callId
  (hasCallId && !hasContent && !MESSAGE_EVENT_TYPES.has(eventType) &&
   eventType !== "MessageStatusCallback" && eventType !== "PresenceChatCallback");
```

Remover `/call/i.test(eventType)` e `/call/i.test(notification)` (substring `Callback` é a fonte do falso positivo).

### 2. Enviar a mensagem automática nós mesmos
Quando `isCallEvent && !p.fromMe`, após persistir a mensagem 📞:
- Ler `call_reject_enabled` e `call_reject_message` do `channels` (já existem após migration anterior).
- Se ativado, chamar `zapiSendText(channel, phoneN, message)` para garantir que o cliente receba a mensagem mesmo se a config da Z-API tiver expirado.
- Logar erro mas não falhar o webhook.

### 3. Limpeza de dados (corrigir mensagens marcadas erradamente)
Migration de cleanup: para `zapi_messages` com `media_type='call'` cujo `text` **não** começa com "📞", `from_me=true`, ou `text` claramente não-chamada → resetar `media_type` para `NULL` (texto/áudio normal). Filtro seguro:

```sql
UPDATE zapi_messages
SET media_type = NULL
WHERE media_type IN ('call','call_missed')
  AND (from_me = true OR text NOT LIKE '📞%')
  AND created_at > now() - interval '6 hours';
```

(Limito a 6h para não tocar histórico antigo legítimo.)

### 4. Validação
- Pedir uma chamada de teste após deploy.
- Conferir nos logs: aparece `[zapi-webhook] call event detected` apenas para chamadas reais.
- Conferir no celular: cliente recebe a mensagem automática.
- Conferir `zapi_messages`: novas mensagens normais não vêm mais com `media_type='call'`.

## Arquivos
- `src/routes/api.public.zapi-webhook.$channelId.tsx` (detecção + envio do auto-reply)
- Migration SQL de limpeza

## Não vou mexer
- UI de configuração (já persiste `call_reject_enabled`/`call_reject_message`).
- Lógica de mensagens normais além do `return` defensivo.
