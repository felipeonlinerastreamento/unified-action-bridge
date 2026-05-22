## Problema

Atendentes recebem erro "canal inexistente" ao tentar enviar mensagens no chat.

## Causa raiz

A correção de segurança anterior (`channels_token_exposed`) restringiu o SELECT da tabela `channels` para apenas `admin`/`gestor`:

```sql
"Admin/Gestor view channels" — SELECT, qual: has_role('admin') OR has_role('gestor')
```

Mas as server functions de envio em `src/lib/zapi.functions.ts` carregam o canal usando `context.supabase` (cliente autenticado, sujeito a RLS):

```ts
const channel = await loadZapiChannel(context.supabase, chat.channel_id);
```

Como o atendente não passa na policy de SELECT, o `.single()` retorna vazio e `loadZapiChannel` lança `"Canal não encontrado"`, exibido na UI como "canal inexistente". Admin/gestor não veem o erro porque conseguem ler `channels`.

## Solução

Carregar o canal sempre via `supabaseAdmin` dentro das server functions. O acesso continua seguro porque:

- A função roda no servidor, atrás de `requireSupabaseAuth` (usuário já autenticado).
- As credenciais (`token`, `zapi_client_token`) nunca atravessam para o cliente — só são usadas em `fetch` para a Z-API.
- O RLS na tabela `channels` continua bloqueando leitura de tokens por qualquer cliente (atendente, gestor, admin) via JS — a regra de proteção segue intacta.
- Para verificar que o usuário pertence ao tenant correto, mantemos o gate atual: as queries de `zapi_chats` / `zapi_messages` continuam pelo `context.supabase` (RLS aplicado), e só depois disso o canal é carregado via admin.

## Mudanças

### `src/lib/zapi.functions.ts`

Substituir os 7 call sites:

```ts
const channel = await loadZapiChannel(context.supabase, ...)
```

por:

```ts
const channel = await loadZapiChannel(supabaseAdmin, ...)
```

E adicionar o import de `supabaseAdmin` no topo do arquivo (já existe `loadZapiChannel`, mas provavelmente não existe `supabaseAdmin` — verificar e adicionar `import { supabaseAdmin } from "@/integrations/supabase/client.server";`).

Locais afetados (linhas atuais): 16, 496, 599, 776, 890, 928, 995 — cobrem `getStatus`, `sendText`, `sendMedia`, envio avulso, `deleteMessage`, configuração de webhooks e leitura de webhooks.

### Sem mudança no banco

A policy de SELECT em `channels` permanece restrita a admin/gestor. Nada de RLS, nada de migração.

### Atualizar `mem://security/security-memory`

Documentar o padrão: "tokens de canal nunca devem ser lidos pelo cliente autenticado; server functions carregam credenciais via `supabaseAdmin` após o gate `requireSupabaseAuth`."

## Fora do escopo

- Não alterar policies RLS.
- Não mexer em `src/lib/zapi.server.ts`, `zapi-bot.server.ts` ou `no-comm-automation.server.ts` — esses já usam `supabaseAdmin`.
- Não alterar o fluxo de envio ou a UI.
