

# Migração para Z-API + Bot configurável + Sussurro + Extras

## 1. Substituir GChat por Z-API

### Modelo de canal
A tabela `channels` ganha colunas Z-API (instance_id, instance_token, client_token). A coluna existente `token` é reaproveitada como `instance_token`. `platform` passa a aceitar `"zapi"` (default novos canais).

```sql
ALTER TABLE channels 
  ADD COLUMN zapi_instance_id text,
  ADD COLUMN zapi_client_token text,
  ADD COLUMN webhook_secret text DEFAULT gen_random_uuid()::text,
  ADD COLUMN bot_mode text DEFAULT 'always';  -- always | off_hours | never
```

### Substituir `src/lib/gsystem.functions.ts` por `src/lib/zapi.functions.ts`
Mantém a **mesma assinatura** das server functions (`listAllOpenChats`, `getChatDetail`, `getChatMessages`, `sendText`, `transferChat`, `finalizeChat`, `getChannelStatus`) — assim `central.tsx`, `floating-chat-window.tsx` e `chat-queue-list.tsx` continuam funcionando sem mudança de chamadas.

Implementação interna usa Z-API REST:
- `GET https://api.z-api.io/instances/{id}/token/{token}/status` → status
- `POST .../send-text` → envio
- `GET .../chat-messages/{phone}` → histórico
- Chats abertos vêm da nossa **tabela local** `zapi_chats` (preenchida pelo webhook), não de polling

### Persistência de mensagens (novo)
```sql
CREATE TABLE zapi_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES channels(id),
  phone text NOT NULL,
  contact_name text,
  contact_avatar text,
  status text DEFAULT 'aguardando',  -- aguardando | em_atendimento | finalizado | bot
  sector_name text,
  assigned_to uuid,                  -- profiles.user_id
  unread_count int DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  tags jsonb DEFAULT '[]'::jsonb,
  bot_state jsonb DEFAULT '{}'::jsonb,  -- node atual do fluxo
  created_at timestamptz DEFAULT now(),
  UNIQUE(channel_id, phone)
);

CREATE TABLE zapi_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES zapi_chats(id) ON DELETE CASCADE,
  zapi_message_id text,
  from_me boolean NOT NULL,
  is_whisper boolean DEFAULT false,        -- mensagem interna (sussurro)
  whisper_author uuid,
  text text,
  media_url text,
  media_type text,
  status text DEFAULT 'sent',              -- sent | delivered | read
  is_typing boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER PUBLICATION supabase_realtime ADD TABLE zapi_chats, zapi_messages;
```

Realtime substitui o polling de 5-10s atual.

## 2. Webhook Z-API público

Nova rota `src/routes/api.public.zapi-webhook.$channelId.ts`:
- `POST /api/public/zapi-webhook/{channelId}` recebe eventos Z-API (mensagem recebida, status, presença)
- Valida via `webhook_secret` no header `X-Channel-Secret`
- Insere/atualiza `zapi_chats` e `zapi_messages`
- Se for **mensagem nova de número desconhecido**, dispara o bot do fluxo (passo 3)

URL exibida no menu de configurações para o usuário colar no painel da Z-API:
`https://project--40ab25b5-cec0-4fe2-8de9-27bfd1074392.lovable.app/api/public/zapi-webhook/{channelId}?secret={webhook_secret}`

## 3. Bot de menu configurável

### Tabela de fluxo
```sql
CREATE TABLE zapi_bot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES channels(id),  -- null = global
  name text NOT NULL,
  is_active boolean DEFAULT true,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz DEFAULT now()
);
```

`nodes` é um array de nós: cada nó tem `id`, `type` (`message` | `menu` | `route_to_sector` | `route_to_least_loaded` | `end`), `text` (com `{{contactName}}`), `options` (`[{key:"1", label:"...", next:"node_id"}]`), `target_sector`.

**Fluxo padrão (semente da migration)** já materializa o exemplo:
- Nó 1 (menu): "👋 Olá {{contactName}} bom dia... [1] Atendente [2] Comercial [3] 2ª via [4] Finalizar"
- "1" → nó 2 (message: "Por favor, informe seu nome e a placa...") → nó 3 (route_to_least_loaded sector="atendimento")
- "2" → route_to_sector "comercial"
- "3" → route_to_sector "financeiro"
- "4" → end (envia "Atendimento finalizado, obrigado!")

### Roteamento "menor carga"
Função SQL:
```sql
CREATE FUNCTION pick_least_loaded_agent(_sector text) RETURNS uuid
-- conta zapi_chats.status='em_atendimento' por assigned_to
-- retorna o profiles.user_id com menor count que esteja no setor
```

### Bot mode por canal (`channels.bot_mode`)
- `always`: dispara em toda conversa nova
- `off_hours`: só fora de 8-18h ou quando 0 atendentes online no setor
- `never`: vai direto para fila

### Editor visual
Nova página `src/routes/configuracoes.zapi.tsx` com:
- **Card 1 — Conexão**: campos instance_id, instance_token, client_token, webhook_secret, URL do webhook (copiar), botão "Testar conexão" (chama Z-API status), modo do bot (select).
- **Card 2 — Fluxo do menu**: lista de nós editáveis (drag-to-reorder). Cada nó: tipo, texto (textarea com preview de variáveis), opções (key + label + próximo nó via select), setor destino. Botão "Adicionar nó" + "Pré-visualizar fluxo" (simula a conversa).
- **Card 3 — Setores e fila**: mapeia chave do menu → setor existente em `sectors`.

Adiciona item no `app-sidebar.tsx`: "Z-API & Bot" (ícone `Bot`, rota `/configuracoes/zapi`).

## 4. Sussurro (mensagem interna)

### UI no input da conversa (`central.tsx` + `floating-chat-window.tsx`)
- Ao lado do botão Enviar, novo botão ícone `EyeOff` (Sussurro). Toggle visual: quando ativo, o input fica com borda âmbar e placeholder muda para "Sussurro interno (não vai para o cliente)".
- Ao enviar com sussurro ativo, chama `sendWhisper` (não Z-API) — apenas insere em `zapi_messages` com `is_whisper=true`.

### Renderização
Sussurros aparecem no histórico como balão âmbar com borda tracejada, ícone 🤫 e nome do autor: "Sussurro · João: vou transferir para o financeiro". Clientes nunca veem (não chega na Z-API).

## 5. Extras escolhidos

### Respostas rápidas
```sql
CREATE TABLE zapi_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL,        -- ex: "/saudacao"
  label text NOT NULL,
  content text NOT NULL,
  created_by uuid,
  is_global boolean DEFAULT false
);
```
- Botão `Zap` no input abre popover com lista de templates. Digitar `/` no input filtra inline.
- Card de gestão na página `/configuracoes/zapi`: CRUD simples.

### Tags coloridas
- Coluna `tags jsonb` em `zapi_chats` (já criada acima): `[{name:"VIP", color:"#a78bfa"}]`.
- No header da conversa, badges + botão `+` abre popover para adicionar/remover tags.
- Filtro na fila (`chat-queue-list.tsx`) por tag.

### Indicador de digitando + status
- Webhook Z-API recebe eventos `presence` e `message-status` → atualiza `zapi_messages.status` e `zapi_chats.bot_state.is_typing`.
- UI: balão "digitando..." abaixo do header quando `is_typing=true`. Mensagens próprias mostram ✓ (sent), ✓✓ cinza (delivered), ✓✓ azul (read).

## 6. Arquivos

### Criar
- `supabase/migrations/<ts>_zapi_migration.sql` — todas as tabelas + RLS + seed do fluxo padrão
- `src/lib/zapi.functions.ts` — substitui `gsystem.functions.ts` (mesma API)
- `src/lib/zapi-bot.server.ts` — engine do bot (avalia nó, gera próxima mensagem, decide roteamento)
- `src/routes/api.public.zapi-webhook.$channelId.ts` — endpoint público
- `src/routes/configuracoes.zapi.tsx` — página de admin
- `src/components/configuracoes/zapi-connection-config.tsx`
- `src/components/configuracoes/zapi-bot-flow-editor.tsx`
- `src/components/configuracoes/zapi-quick-replies-config.tsx`
- `src/components/central/whisper-toggle.tsx` — botão sussurro
- `src/components/central/quick-replies-popover.tsx`
- `src/components/central/chat-tags.tsx`
- `src/hooks/use-zapi-realtime.tsx` — subscreve `zapi_chats`/`zapi_messages` via Supabase Realtime

### Editar
- `src/routes/central.tsx` — trocar `useQuery` polling por hook realtime; adicionar botão sussurro, popover de respostas rápidas e tags no header; remover blocos GChat-only (subClientLinker mantém)
- `src/components/central/chat-queue-list.tsx` — ler de `zapi_chats`; adicionar filtro por tag e indicador "digitando"
- `src/components/central/floating-chat-window.tsx` — adicionar sussurro, status de mensagens e respostas rápidas
- `src/components/app-sidebar.tsx` — novo item "Z-API & Bot"
- `src/lib/gsystem.functions.ts` — **deletar** (após confirmar central.tsx migrada)

## 7. Detalhes técnicos

- **Migração de canais existentes**: a coluna `platform` define o caminho. Como o usuário escolheu "substituir totalmente", uma migration força `platform='zapi'` em todos os canais e os marca `is_active=false` até o usuário preencher os campos Z-API novos. Toast na página de configurações alerta: "Reconfigure seus canais com credenciais Z-API".
- **Bot engine**: ao entrar mensagem do cliente, lê `zapi_chats.bot_state.current_node`. Se `null`, decide via `bot_mode` se inicia o fluxo. Avalia o nó, grava resposta como `zapi_message from_me=true`, manda via Z-API REST, atualiza `bot_state`. Quando atinge `route_to_*`, seta `assigned_to`/`sector_name`/`status='em_atendimento'` e zera `bot_state.current_node`.
- **`{{contactName}}`** resolvido a partir de `zapi_chats.contact_name` (vem do webhook Z-API). Fallback "amigo(a)".
- **Realtime**: o central deixa de fazer polling. `useZapiRealtime` subscreve `zapi_chats` (lista) e `zapi_messages` (chat aberto). Reduz tráfego e elimina o lag de 5-10s.
- **Sussurro nunca toca a Z-API** — fica isolado no banco, RLS permite só usuários autenticados ler/escrever em chats que enxergam.
- **Webhook seguro**: `webhook_secret` por canal; resposta 401 se ausente. Validação do payload com Zod. Sem PII no log.
- **Stable URL para Z-API**: `https://project--40ab25b5-cec0-4fe2-8de9-27bfd1074392.lovable.app/api/public/zapi-webhook/{channelId}` (não muda se renomear o projeto).

