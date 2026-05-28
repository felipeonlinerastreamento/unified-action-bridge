## Plano: Correções de segurança da Lovable Cloud

Assim que o backend de migrações voltar a aceitar conexões, aplico uma única migração cobrindo todos os achados do scan.

### 1. Bucket `chat-media` → privado
`UPDATE storage.buckets SET public=false`. Acesso passa a exigir URL assinada. Se houver `<img src>` apontando direto pra CDN no app, troco por `createSignedUrl`.

### 2. Tabelas de compras — remover `USING(true)` em escrita
Tabelas: `ticket_purchase_items`, `ticket_purchase_requests`, `ticket_compra_equipamento_items`.
- DROP da policy `*_all` / `*_manage` (ALL com `true`)
- SELECT: autenticados (mantém visibilidade)
- INSERT / UPDATE / DELETE: somente `admin` ou `gestor` via `public.has_role()`

### 3. `zapi_quick_replies`
Substituir a UPDATE policy atual por uma que permite:
- editar a própria resposta (own, não global)
- editar respostas globais apenas se `admin`/`gestor`

### 4. Realtime — escopo por usuário
Hoje `realtime.messages` aceita `USING(true)`, então qualquer autenticado pode assinar qualquer canal. Vou trocar por:
- SELECT: `realtime.topic() = 'user:' || auth.uid()` OU prefixo `public:*`
- INSERT: somente `'user:' || auth.uid()`

⚠️ **Impacto no frontend:** toda subscrição realtime precisa usar nomes de canal nessa convenção. Hoje o app usa `postgres_changes` em canais como `messages`, `notifications`, etc. — esses continuam funcionando porque `postgres_changes` é filtrado por RLS da tabela, não pelas policies de `realtime.messages` (que governam broadcast/presence). Então o impacto fica restrito a eventuais usos de `channel.send()` / broadcast, que vou auditar antes.

### 5. Função SECURITY DEFINER pública (linter)
Achado genérico: alguma função com `EXECUTE` para `anon`. Vou listar funções `SECURITY DEFINER` no schema `public` e revogar `EXECUTE FROM anon, public` onde não for intencional (mantendo `has_role` etc. acessíveis ao `authenticated` quando usadas em RLS).

### Ordem de execução
1. Backend volta → rodar a migração consolidada
2. Auditar uso de broadcast realtime e ajustar nomes de canal se necessário
3. Trocar URLs públicas de `chat-media` por signed URLs onde aplicável
4. Rodar scan novamente para confirmar

Confirma que posso seguir com a convenção `user:<uuid>` / `public:*` para canais de broadcast?