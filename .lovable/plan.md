## Problema

O webhook Z-API (`src/routes/api.public.zapi-webhook.$channelId.tsx`) hoje só reconhece mensagens de **texto, imagem, áudio, vídeo, documento e contato (vCard)**. Quando o cliente envia:

- **📍 Localização** (payload `p.location` com `latitude`/`longitude`) → o evento é considerado "sem conteúdo" (`hasContent = false`) e descartado silenciosamente. Nada aparece no chat.
- **📞 Chamada recebida / perdida** (payload `type: "CallReceivedCallback"` com `callId`, `status`, `isVideoCall`) → cai fora do `MESSAGE_EVENT_TYPES` e também não é registrado.

Por isso o operador "perde" essas interações no painel mesmo elas existindo no WhatsApp.

## Correção

Tudo no webhook + componente de bolha (sem mexer em schema, RLS, realtime ou UI principal):

### 1. `src/routes/api.public.zapi-webhook.$channelId.tsx`

- Tratar `p.location`:
  - Adicionar `p.location` em `hasContent`.
  - Texto: `📍 Localização` (anexar `name` / `address` quando vierem).
  - `mediaType = "location"`, `mediaUrl = https://www.google.com/maps?q=<lat>,<lng>` (ou `p.location.url` quando presente).
  - Persistir junto ao fluxo existente de inserção em `zapi_messages` (preview da conversa = "📍 Localização").
- Tratar chamadas:
  - Reconhecer `type` `CallReceivedCallback` (e variantes `NotificationCallback` com `notificationType` relativo a chamada).
  - Mapear status Z-API → texto:
    - `missed` / `timeout` → `📞 Chamada perdida`
    - `received` / `accepted` → `📞 Chamada recebida` (com duração quando vier)
    - `rejected` → `📞 Chamada recusada`
    - `offer` (toque) → ignorar (ruidoso) salvo se nenhum follow-up vier
  - Inserir como mensagem do cliente (`from_me=false`), `media_type="call"`, sem `media_url`. Atualizar `last_message_*` da `zapi_chats` para o operador ver "Chamada perdida" na lista.
- Manter **echo guards** e o fluxo de bot/queue existentes intactos — chamadas e localizações **não** disparam bot/CSAT, apenas registram a interação e marcam `unread_count++` quando aplicável.

### 2. `src/components/central/message-media.tsx`

Adicionar dois novos `mediaType` à bolha:
- `"location"` → card com ícone `MapPin`, título "Localização compartilhada", endereço/nome quando vier, e link "Abrir no Google Maps".
- `"call"` → bloco compacto com ícone `Phone`/`PhoneMissed` e cor de destaque para chamada perdida (token `text-destructive`).

### 3. `src/lib/zapi.functions.ts`

Nenhuma alteração de schema — `getChatMessages` já repassa `media_url` / `media_type` brutos, então as novas bolhas funcionam imediatamente.

## Critérios de aceite

- Cliente envia localização no WhatsApp → aparece em tempo real no painel como bolha de localização clicável (Google Maps).
- Cliente liga e operador não atende → aparece "📞 Chamada perdida" como mensagem do cliente, e o chat sobe na fila com badge não-lido.
- Chamada atendida → aparece "📞 Chamada recebida" (com duração se Z-API enviar).
- Nenhuma regressão em texto/imagem/áudio/vídeo/documento/contato, no bot, no CSAT, ou no fluxo de fila.
