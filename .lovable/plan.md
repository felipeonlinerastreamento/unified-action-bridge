## Garantir acesso a todas as mensagens do histórico do chat

### Confirmação de segurança dos dados

Nenhuma mensagem é apagada. O webhook (`api.public.zapi-webhook.$channelId.tsx`) só faz `INSERT`/`UPDATE` em `zapi_messages`. Não existe `DELETE`, job de limpeza, TTL ou trigger que remova histórico. O que limita hoje é apenas a quantidade buscada por requisição na UI.

### Mudança no servidor — `src/lib/zapi.functions.ts` (`getChatMessages`)

Adicionar paginação opcional, mantendo o comportamento atual como padrão:

- Novo input opcional: `before?: string` (ISO timestamp) e `limit?: number` (default 500, máx 500).
- Quando `before` for informado, busca as `limit` mensagens **anteriores** a esse timestamp; quando não, mantém o comportamento atual (últimas 500 do chat).
- Continua devolvendo em ordem cronológica crescente.
- Resolução de nomes/whisper/responsável continua igual.

Pseudo-código:

```ts
.inputValidator(z.object({
  channelId: z.string().uuid(),
  chatId: z.string().min(1).max(255),
  before: z.string().datetime().optional(),
  limit: z.number().int().min(1).max(500).optional(),
}).parse)

const lim = data.limit ?? 500;
let q = context.supabase
  .from("zapi_messages")
  .select("*")
  .eq("chat_id", data.chatId)
  .order("created_at", { ascending: false })
  .limit(lim);
if (data.before) q = q.lt("created_at", data.before);

const { data: rowsDesc } = await q;
const rows = (rowsDesc || []).slice().reverse();
return { ..., hasMore: (rowsDesc?.length ?? 0) === lim };
```

### Mudança na UI — painel do chat (`src/routes/central.tsx`)

- Após o fetch inicial, se `hasMore = true`, mostrar no topo da lista um botão **"Carregar mensagens anteriores"** (ou auto-carregar quando o usuário rola até o topo).
- Ao clicar/rolar, dispara nova chamada com `before = createdAt da mensagem mais antiga atualmente em tela`, anexa o resultado no início da lista e mantém a posição de scroll.
- Repetir até `hasMore = false` (ou seja, até carregar a primeira mensagem do chat).

### Mudança na janela flutuante — `src/components/central/floating-chat-window.tsx`

Aplicar o mesmo botão "Carregar anteriores" no topo (a janela usa o mesmo `getChatMessages`).

### Sem mudanças

- Webhook, gravação, RLS, schema, realtime, contadores.
- Comportamento padrão (sem `before`) segue retornando as últimas 500 — a paginação é puramente aditiva.

### Resultado para o usuário

- A primeira renderização continua rápida (500 mensagens recentes).
- Qualquer mensagem antiga, por mais antiga que seja, fica acessível clicando "Carregar anteriores" até chegar ao início — sem nenhuma mensagem descartada.
