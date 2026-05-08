## Problema
No chat de Cecília Alves (5527999598630), o atendimento finalizado foi indevidamente reaberto e a mensagem "Obrigado pela sua avaliação!" apareceu como se viesse do cliente.

## Causa raiz
1. Felipe finalizou o atendimento. Como CSAT está ativo, o sistema enviou a mensagem de CSAT (que contém o texto "[ 1 ] - Ruim 😒, [ 2 ] - Bom 😊, [ 3 ] - Ótimo 😍") via `sendText` e gravou `csat_pending`.
2. A Z-API ecoou essa mensagem do operador como `ReceivedCallback` com `fromMe=true`. O webhook força `effectiveFromMe = false` para qualquer `ReceivedCallback` (linhas 196-210), então o eco entra no ramo de captura de CSAT (linha 248).
3. O ramo de CSAT extrai score com `String(text).trim().match(/[123]/)` (linha 280) — regex frouxa que acha "1" dentro do próprio texto da pergunta de CSAT. Score 1 (Ruim) foi registrado no `csat_responses` (confirmado no DB: `raw_response` = a própria mensagem da pergunta de CSAT) e o `csat_pending` foi consumido.
4. O webhook ainda enviou o `thanks_message` "Obrigado pela sua avaliação!" via `zapiSendText`. Esse envio foi gravado em `zapi_messages` com `from_me=true` mas sem `zapi_message_id`. Em seguida o eco da Z-API chegou como `ReceivedCallback` (fromMe=true → forçado a false) e foi inserido como NOVA linha (não casa pelo `zapi_message_id` porque o registro do envio não tinha um), aparecendo no chat do lado esquerdo.
5. ~5 minutos depois a cliente respondeu de fato "3". `csat_pending` já não existia (foi consumido pelo eco) → caiu no fluxo de reabertura (linha 447) e o chat voltou para `aguardando`.

## Correção

### 1. Tornar a extração do score de CSAT estrita (`src/routes/api.public.zapi-webhook.$channelId.tsx`)
Trocar `String(text).trim().match(/[123]/)` por uma regex que só aceite a resposta isolada do cliente, tolerando espaços e emojis:

```ts
const trimmed = String(text).trim();
const m = trimmed.match(/^([123])(?:\s|$)/) || trimmed.match(/^nota\s*([123])/i);
const score = m ? Number(m[1]) : null;
```

Assim o texto longo da pergunta de CSAT (que contém os dígitos 1, 2 e 3) não casa mais. Apenas respostas como `3`, `3 `, `3 obrigada`, `Nota 3` casam.

### 2. Defesa adicional: ignorar ecos do próprio operador no ramo de CSAT
Antes de chegar à seção CSAT, capturar o flag original `const originalFromMe = !!p.fromMe;` antes da linha 206 que o sobrescreve. No bloco da linha 248, adicionar:
```ts
if (!p.fromMe && !originalFromMe && !isGroupMessage && text) { ... }
```
Isso garante que ecos do operador (mesmo que cheguem como `ReceivedCallback`) nunca consomem `csat_pending` nem disparam o "thanks".

### 3. Evitar a duplicata visual da mensagem de "thanks"
Quando o webhook envia o `thanks` (linhas 318-326), gravar também o `zapi_message_id` retornado pelo `zapiSendText`. Hoje a inserção não inclui `zapi_message_id`, então quando o eco volta como `ReceivedCallback`, o `persistZapiMessage` não encontra o registro existente e cria uma segunda linha. Ajustar para:
```ts
const sendRes = await zapiSendText(creds, phone, thanks);
const sentId = (sendRes as any)?.messageId || (sendRes as any)?.id || null;
await supabaseAdmin.from("zapi_messages").insert({
  chat_id: (pending as any).chat_id,
  zapi_message_id: sentId,
  from_me: true,
  text: thanks,
  status: "sent",
});
```
Combinado com a proteção já existente em `persistZapiMessage` (não rebaixa `from_me=true` para `false`), o eco será apenas um UPDATE no mesmo registro, sem aparecer do lado do cliente.

## Backfill / limpeza para o caso reportado
Para o chat `42199bff-cf7e-4f06-b852-f7e0815c1415`:
1. Apagar a resposta CSAT bogus:
   `DELETE FROM csat_responses WHERE id = '0689c962-09f1-4092-957b-74a843d13e99';`
2. Reverter o status do chat (estava finalizado e foi reaberto pela mensagem "3"):
   `UPDATE zapi_chats SET status='finalizado' WHERE id='42199bff-cf7e-4f06-b852-f7e0815c1415';`
3. (Opcional) Apagar a linha do "Obrigado pela sua avaliação!" duplicada do lado do cliente:
   `DELETE FROM zapi_messages WHERE id = '464ee623-a998-41fd-b0bd-3baaab4593ad';`
4. Registrar manualmente o score real (3 = Ótimo) que a cliente enviou às 13:08, se desejar manter histórico de CSAT correto.

Confirmar com o usuário antes de aplicar o backfill.

## Validação
1. Operador finaliza um chat com CSAT ativo → mensagem de pergunta sai uma vez, **não** dispara `csat_responses` automaticamente, **não** envia "thanks".
2. Cliente responde "3" → `csat_responses` recebe score=3, `csat_pending` é consumido, `thanks` é enviado uma única vez e aparece **à direita**.
3. Cliente responde algo que não é 1/2/3 (ex: "Obrigada") → `csat_pending` é descartado, fluxo normal segue (reabre chat). Comportamento atual mantido.
4. Verificar no chat de Cecília que após o backfill ele volta a aparecer como finalizado.

## Arquivos
- `src/routes/api.public.zapi-webhook.$channelId.tsx` — itens 1, 2 e 3.
- `supabase/migrations/<nova>.sql` — backfill (apenas se aprovado).