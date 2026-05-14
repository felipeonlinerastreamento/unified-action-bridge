## Causa raiz

Confirmado nos logs do worker (último 1h, mesmo grupo `120363338602106435`):

```
[warn] [zapi-webhook] 23505 on insert but no row found by phone {"phone":"120363338602106435"}
[warn] [zapi-webhook] unknown event {"type":"DeliveryCallback","phone":"120363338602106435-group", ...}
```

Para todo evento desse grupo o webhook tenta inserir um chat novo, colide com o índice `zapi_chats_channel_id_phone_key (channel_id, phone)`, e a recuperação `23505` re-busca pela chave errada — então o handler retorna em `line 738` e **a mensagem nunca é gravada em `zapi_messages`**. Por isso só apareceu o "Bom Dia" (a primeira que conseguiu criar o chat); todas as seguintes caíram nesse caminho silencioso.

A divergência: a função SQL `normalize_zapi_phone` adiciona o prefixo `lid:` para qualquer ID com 15+ dígitos que **não contenha** `@g.us` nem `-\d{8,}`. IDs de grupo modernos (ex.: `120363338602106435`) caem nesse caso, então `phone_normalized` é gravado como `lid:120363338602106435`.

Já o webhook (`normalizeIncomingPhone`) trata o mesmo ID como grupo e devolve apenas dígitos `120363338602106435`. Resultado:

- Lookup inicial `eq("phone_normalized", phone)` não acha a linha existente.
- Insert estoura `23505` (colide com `(channel_id, phone)`).
- Recuperação `eq("phone_normalized", phone)` também não acha → `return`.

Adicionalmente: eventos `DeliveryCallback` de grupo chegam com `phone` terminado em `-group` e caem em "unknown event" — apenas ruído, não relacionado ao drop, mas pode ser silenciado depois.

## O que vou fazer

Mudança cirúrgica no `src/routes/api.public.zapi-webhook.$channelId.tsx`, sem migration:

### 1. Recuperação 23505 robusta (corrige o drop atual)
No catch do erro `23505` (~linha 727), além de re-buscar por `phone_normalized`, também tentar por `(channel_id, phone)` — que é exatamente o índice que estourou. Se achar, segue o fluxo de chat existente; se não achar, mantém o `return` atual com warn.

### 2. Lookup inicial cobre grupos
No upsert do chat (linha ~651), quando `isGroupMessage`, primeiro tentar `eq("phone", phone)` antes do `eq("phone_normalized", phone)`. Para grupos esse é o identificador estável (e o índice unique `(channel_id, phone)` garante 1 linha por grupo). Mantém compatibilidade com chats individuais.

### 3. Mesma cobertura no handler de chamadas
Aplicar a mesma busca dupla (`phone` + `phone_normalized`) na resolução de `existingChat` para call events em grupos (linha ~341), pelo mesmo motivo.

### 4. Reconhecer `DeliveryCallback` de grupo
Adicionar `DeliveryCallback` à lista de tipos tratados (mesmo que como no-op silencioso) para parar o ruído de "unknown event" com `phone:"...-group"`. Isso é cosmético; o fix real é (1)+(2).

### 5. Validação
Após deploy, reproduzir enviando 3 mensagens seguidas no grupo "Alinhamentos logística e atendimento" e conferir:
- chat permanece único (sem novas linhas em `zapi_chats`),
- todas as 3 aparecem em `zapi_messages` com `from_me=false`,
- nenhum log `23505 on insert but no row found by phone` para o ID do grupo.

## Arquivos afetados

- `src/routes/api.public.zapi-webhook.$channelId.tsx` — somente os pontos descritos acima.

Sem alteração de schema, sem mudança em UI, sem mexer em `normalize_zapi_phone` (mudar a função SQL exigiria reescrever `phone_normalized` de todos os chats e quebraria a lógica LID atual). A correção fica no único ponto que precisa: alinhar lookup/recuperação do webhook com o que o DB já grava.
