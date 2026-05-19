# Corrigir "duplicate key" ao iniciar conversa

## Causa raiz

Tabela `zapi_chats` tem coluna gerada:

```
phone_normalized = normalize_zapi_phone(phone)  -- GENERATED ALWAYS
```

E índice único parcial:

```
uniq_zapi_chats_channel_phone_norm
ON zapi_chats (channel_id, phone_normalized)
WHERE phone_normalized IS NOT NULL AND phone_normalized NOT LIKE 'lid:%'
```

Em `src/lib/zapi.functions.ts` (`createChat`, linhas 706–728) a verificação de chat existente é feita por `phone` cru:

```ts
.eq("channel_id", data.channelId)
.eq("phone", phone)            // ❌ string crua
.maybeSingle();
```

Quando o webhook já criou o chat antes (com `phone` em formato diferente — ex.: `5511987654321` vindo do Z-API) e o operador digita `11987654321` na UI, o `select` por `phone` cru não encontra a linha, o handler tenta `INSERT`, e o banco rejeita pelo índice único em `phone_normalized` → `duplicate key value violates unique constraint "uniq_zapi_chats_channel_phone_norm"`.

## Correção (escopo mínimo, só `src/lib/zapi.functions.ts`)

Substituir o fluxo "select-then-insert/update" do `createChat` por um caminho idempotente que respeita o índice em `phone_normalized`:

1. **Calcular o normalizado uma vez** chamando a função SQL existente via RPC (não precisa migration — `normalize_zapi_phone(text)` já existe). Fallback: replicar a lógica em TS se a chamada falhar.
2. **Procurar chat existente por `phone_normalized`** (não mais por `phone`), filtrando pelo `channel_id`. Isso resolve 95% dos casos sem tocar em escrita.
3. **Se existir** → fazer o `update` atual (status `em_atendimento`, `assigned_to`, `last_message_at`).
4. **Se não existir** → tentar `insert`; se ainda assim cair em violação 23505 nesse índice específico, fazer um **re-select por `phone_normalized`** e seguir como existente (resolve corrida entre webhook e UI).
5. Manter o restante do handler igual (envio da mensagem opcional, retorno `attendanceId`).

Pseudocódigo:

```text
norm = rpc('normalize_zapi_phone', { raw: phone }) ?? normalizeFallback(phone)

existing = select id from zapi_chats
  where channel_id = X and phone_normalized = norm
  limit 1

if existing: update ... where id = existing.id
else:
  try insert {...}
  catch err if err.code === '23505' and constraint contém 'phone_norm':
    existing = re-select by (channel_id, phone_normalized)
    update existing
```

## Arquivos alterados

- `src/lib/zapi.functions.ts` — apenas o handler `createChat` (linhas 692–753). Sem mudanças de schema, sem mudanças em UI, sem mexer em webhook ou bot.

## Fora de escopo

- Não alterar `normalize_zapi_phone`, índice, ou tabela.
- Não mudar o fluxo do webhook (`api.public.zapi-webhook.$channelId.tsx`) — ele já usa o normalizado corretamente.
- Não tocar em `central.tsx` nem na UI do modal "Iniciar Conversa".
