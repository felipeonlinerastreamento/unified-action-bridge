# Chamadas de WhatsApp: detecção + auto-rejeição

## Problema
- Nenhuma mensagem com `media_type` `call`/`call_missed` foi gravada (consulta no banco retornou 0 linhas).
- A mensagem automática "esse número não aceita ligações" também não chega ao cliente.
- O webhook recebe eventos da Z-API normalmente (200 OK), mas não há logs do ramo de chamada — provavelmente o payload da Z-API não bate com nenhum dos formatos que verificamos hoje (`type === "CallReceivedCallback"`, `notification` começando com `CALL_`, etc.).

## Diagnóstico atual
Hoje em `src/routes/api.public.zapi-webhook.$channelId.tsx` consideramos um evento como chamada apenas se:
1. `notification` começa com `CALL_`, ou
2. `type` é `CallReceivedCallback` / `CallReceivedNotificationCallback`, ou
3. `type === "NotificationCallback"` com `notification` contendo "call".

A Z-API real, em várias contas, manda `type: "ReceivedCallback"` com `callId` (sem `text`/`image`/etc.) ou `type: "CallReceivedCallback"` com nomes ligeiramente diferentes. Sem log do payload bruto não conseguimos confirmar.

A configuração de auto-rejeição também precisa ser verificada: `updateCallRejectionConfig` chama `PUT /update-call-reject-auto`, mas a UI só dispara quando o usuário clica em "Salvar rejeição de chamadas" — quero confirmar se foi salvo no canal ativo.

## Plano

### 1. Logar payloads desconhecidos para diagnóstico
No webhook, antes do branch `isMessageEvent`, adicionar log resumido (`type`, `notification`, presença de `callId`, `phone`, `fromMe`) para qualquer evento que **não seja** mensagem reconhecida nem status/presence. Assim, na próxima ligação, vemos o formato real no `server-function-logs`.

### 2. Ampliar detecção de chamada
Atualizar `isCallEvent` em `api.public.zapi-webhook.$channelId.tsx` para também considerar:
- presença do campo `callId` no payload (quando `type` não é mensagem nem status), OU
- `type` contendo a substring `Call` (case-insensitive), OR
- `notification` contendo "call" mesmo sem prefixo `CALL_`.

Isso cobre as variações conhecidas da Z-API sem regredir mensagens normais (que continuam priorizadas porque o branch `isCallEvent` é exclusivo do `isMessageEvent`).

### 3. Garantir auto-rejeição persistida no canal
- Em `channels`, ler/gravar campos `call_reject_enabled` (boolean) e `call_reject_message` (text) — hoje só vivem em memória do componente.
- `ZapiConnectionConfig` passa a:
  - Carregar valores salvos ao trocar de canal.
  - Salvar localmente (Supabase) **junto** com a chamada `updateCallRejectionConfig` (que aplica na Z-API via `/update-call-reject-auto` + `/update-call-reject-message`).
- `setupZapiWebhooks` (botão "Configurar webhooks") passa a também reenviar a configuração de auto-rejeição se o canal tiver `call_reject_enabled = true`, garantindo idempotência caso a Z-API perca o estado.

### 4. Migration
Adicionar colunas em `public.channels`:
- `call_reject_enabled boolean NOT NULL DEFAULT true`
- `call_reject_message text` (default = mensagem padrão BR)

### 5. Validação
- Pedir ao usuário que faça uma chamada de teste após o deploy.
- Conferir em `server-function-logs` que aparece `[zapi-webhook] unknown event` com o payload, ou que entra direto no branch de chamada.
- Conferir em `zapi_messages` que `media_type IN ('call','call_missed')` foi gravado.
- Conferir no celular do testador que recebeu a mensagem automática.

## Arquivos afetados
- `src/routes/api.public.zapi-webhook.$channelId.tsx` (logs + detecção ampliada)
- `src/components/configuracoes/zapi-connection-config.tsx` (load + save dos campos de rejeição)
- `src/lib/zapi.functions.ts` (`updateCallRejectionConfig` também grava em `channels`; `setupZapiWebhooks` reaplica rejeição se ativada)
- Migration: `ALTER TABLE channels ADD COLUMN call_reject_enabled`, `call_reject_message`

## Observações
- Não mexo na lógica de mensagens normais.
- Não troco a UI; só adiciono persistência aos toggles existentes.
- Após o ajuste, a primeira ligação real vai gerar log do formato exato — se ainda não cair no branch certo, ajusto a detecção com base nesse log.
