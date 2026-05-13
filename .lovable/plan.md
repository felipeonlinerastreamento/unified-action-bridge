## Causa do problema

Encontrei a raiz da falha. A Z-API **não envia** o tipo `CallReceivedCallback` (que o código atual procura). Segundo a doc oficial, chamadas chegam como:

```json
{
  "type": "ReceivedCallback",
  "notification": "CALL_VOICE" | "CALL_MISSED_VOICE" | "CALL_MISSED_VIDEO",
  "callId": "...",
  "phone": "...",
  "fromMe": false
}
```

Como o tipo é `ReceivedCallback` (igual a mensagens normais) e não há `text/image/audio/...`, o evento cai na trilha geral, falha o `hasContent` e é descartado silenciosamente. Por isso nenhuma chamada aparece no chat.

## O que vou alterar

### 1. Detecção correta do evento de chamada — `src/routes/api.public.zapi-webhook.$channelId.tsx`

Substituir a heurística atual por detecção baseada em `p.notification`:

```ts
const notification = String(p.notification || "").toUpperCase();
const isCallEvent = notification.startsWith("CALL_");
```

Mapeamento:
- `CALL_VOICE` → "📞 Chamada recebida" (`mediaType: "call"`)
- `CALL_MISSED_VOICE` → "📞 Chamada perdida" (`mediaType: "call_missed"`)
- `CALL_MISSED_VIDEO` → "📞 Videochamada perdida" (`mediaType: "call_missed"`)
- `CALL_VIDEO` → "📞 Videochamada recebida" (`mediaType: "call"`)

Manter `messageId = p.callId || p.messageId` para evitar duplicidade. Persistir como mensagem do cliente (`fromMe: false`), atualizar `last_message_preview`, `last_message_at` e incrementar `unread_count`. O bloco existente (linhas 240-322) já faz isso corretamente — só precisa receber o evento.

### 2. Rejeição automática de chamadas + mensagem ao cliente

A Z-API tem dois endpoints nativos para isso:

- `PUT /update-call-reject-auto` — `{ "value": true }` ativa rejeição automática de toda chamada de voz recebida.
- `PUT /update-call-reject-message` — `{ "value": "..." }` define a mensagem que será enviada ao cliente após a rejeição.

Plano:

a) **`src/lib/zapi.server.ts`**: adicionar dois helpers
   - `zapiSetCallRejectAuto(channel, enabled: boolean)`
   - `zapiSetCallRejectMessage(channel, message: string)`

b) **`src/lib/zapi.functions.ts`**: criar server function `updateCallRejectionConfig({ channelId, enabled, message })` protegida com `requireSupabaseAuth` + role admin/gestor. Chama os dois helpers acima na Z-API e retorna o resultado. Não precisa armazenar nada no Supabase — a configuração vive na própria instância Z-API.

c) **`src/components/configuracoes/zapi-connection-config.tsx`** (ou criar uma seção nova dentro de `configuracoes/zapi`): adicionar um card "Rejeição automática de chamadas" com:
   - Switch "Rejeitar todas as chamadas recebidas" (default ligado).
   - Textarea com a mensagem padrão pré-preenchida:
     ```
     *Essa é mensagem automática*

     Esse número, por ser chat, não aceita ligações de WhatsApp, somente ligação normal.
     ```
   - Botão "Salvar" que chama `updateCallRejectionConfig`.

d) Como a Z-API envia a mensagem automaticamente após rejeitar, **não é necessário** disparar nada extra no webhook. O código atual já vai registrar no chat o "📞 Chamada recusada" (vindo como `CALL_MISSED_VOICE` após a rejeição) + a mensagem automática que a própria Z-API envia será ecoada como `MessageStatusCallback`/`SentCallback` e aparecerá no histórico normalmente.

### 3. Aplicar a configuração inicial

Após o usuário aprovar este plano e a UI estar pronta, ele clica em "Salvar" para aplicar as configurações no canal Z-API ativo. Não há migração de banco necessária.

## Arquivos a editar

- `src/routes/api.public.zapi-webhook.$channelId.tsx` — corrigir detecção de chamada via `p.notification`.
- `src/lib/zapi.server.ts` — helpers `zapiSetCallRejectAuto` e `zapiSetCallRejectMessage`.
- `src/lib/zapi.functions.ts` — server function `updateCallRejectionConfig`.
- `src/components/configuracoes/zapi-connection-config.tsx` — UI da seção de rejeição automática.

## Critérios de aceitação

- Chamada de voz/vídeo recebida aparece no chat como bolha 📞 (já existente em `message-media.tsx`).
- Chamada perdida incrementa `unread_count` e move o chat para a fila.
- Com rejeição automática ativada, o cliente recebe a mensagem padrão configurada e o operador vê tanto "📞 Chamada recusada" quanto a mensagem enviada no histórico.
- Configuração persiste na instância Z-API (sobrevive a recargas).