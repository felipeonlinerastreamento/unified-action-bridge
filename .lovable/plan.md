# Correção: mensagens de outro canal aparecendo como recebidas

## Problema
Mensagens enviadas pelo operador via outro dispositivo (WhatsApp Web, celular, outra instância da mesma conta) aparecem no chat **do lado esquerdo**, como se o cliente tivesse mandado.

## Causa
No webhook `src/routes/api.public.zapi-webhook.$channelId.tsx` (linhas 215–227), há uma regra que **força `fromMe = false` em todo evento `ReceivedCallback`**, ignorando a flag original quando ela vem `true`:

```ts
const effectiveFromMe = isReceivedEvent ? false : (isSentEvent ? true : !!p.fromMe);
```

A Z-API entrega mensagens enviadas por outro dispositivo da mesma conta como `ReceivedCallback` com `fromMe: true`. A regra atual descarta isso e grava `from_me = false`.

## Correção
Alterar apenas o cálculo de `effectiveFromMe`:

- `SentCallback` → `true`
- `ReceivedCallback` com `fromMe: true` → **`true`** (operador enviou de outro canal)
- `ReceivedCallback` com `fromMe: false` → `false` (cliente)
- demais casos → segue `!!p.fromMe`

## Escopo
- **Sim:** ~3 linhas no webhook.
- **Não afeta:** identificação/criação de chat (continua por `phone`), portanto **não cria chat duplicado**. Echo guards (`originalFromMe`) seguem usando o flag original e continuam funcionando. UI, banco, tickets e CSAT intactos.
