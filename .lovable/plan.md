## Causa raiz (não é problema do webhook)

Conferi o banco para `Geovane / Seu Instalador` (chat `8d1eeccf…`):

- O webhook **está gravando** as mensagens normalmente — última inbound às 16:37 de hoje, `last_message_at` do chat também atualizado.
- O grupo já acumula **770 mensagens** no histórico.

O bug está em `getChatMessages` (`src/lib/zapi.functions.ts`, linha 211):

```ts
.from("zapi_messages")
.select("*")
.eq("chat_id", data.chatId)
.order("created_at", { ascending: true })   // ordem CRESCENTE
.limit(500);                                 // pega as 500 PRIMEIRAS
```

Em ordem crescente com `limit(500)`, o Postgres devolve as **500 mensagens mais antigas** do chat. Tudo o que vem depois da 500ª mensagem fica invisível no painel — é exatamente o que está acontecendo nos grupos de instaladores:

| Grupo | Total de mensagens | Mensagens visíveis | Invisíveis |
|---|---|---|---|
| Claudio / Seu Instalador | 837 | 500 | 337 |
| Geovane / Seu Instalador | 770 | 500 | 270 |
| Marcus / Seu Instalador | 597 | 500 | 97 |

Por isso o usuário relata "interações acontecendo, mas nada atualiza no chat" mesmo após F5: a query devolve sempre o mesmo bloco antigo. Realtime invalida a query, mas a query continua retornando o mesmo recorte.

## Correção

Em `src/lib/zapi.functions.ts` (`getChatMessages`):

1. Trocar a busca por **últimas 500 em ordem decrescente** e depois reverter para apresentação cronológica:

   ```ts
   const { data: rowsDesc, error } = await context.supabase
     .from("zapi_messages")
     .select("*")
     .eq("chat_id", data.chatId)
     .order("created_at", { ascending: false })
     .limit(500);
   const rows = (rowsDesc || []).slice().reverse();
   ```

2. Manter o restante da função intacto (resolução de nomes, "via X", whisper etc. continuam operando sobre `rows`).

Isso garante que toda nova mensagem (incluindo as de hoje em grupos longos) apareça imediatamente no painel, tanto na Central quanto na janela flutuante (ambas usam `getChatMessages`).

## Sem mudanças

- Webhook (`api.public.zapi-webhook.$channelId.tsx`) não muda — gravação está correta.
- Lista lateral, realtime, contadores de não-lidas, fluxo de bot, finalize, tickets — nada disso é tocado.
- Sem migração, sem mudança de schema, sem alteração de RLS.

## Observação adicional (opcional, não incluso)

Se no futuro um grupo passar de 500 mensagens **na janela atual** (improvável em curto prazo), seria preciso paginação. Por ora, mostrar as últimas 500 resolve 100% do relato. Se quiser, posso já incluir botão "Carregar mais antigas" no mesmo PR — me avise.
