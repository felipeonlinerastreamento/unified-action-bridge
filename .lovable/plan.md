## Problema

Hoje, quando o operador envia uma mensagem direto pelo WhatsApp (celular/WhatsApp Web do mesmo número conectado à Z-API), ela **não aparece** na conversa do sistema. O mesmo vale para mensagens enviadas a partir de outro número/canal Z-API ou outros canais (e-mail).

## Causa raiz

1. **WhatsApp direto (mesmo número Z-API):** o webhook (`/api/public/zapi-webhook/$channelId`) já está preparado para tratar `SentCallback`/`MessageSentCallback` e gravar com `from_me=true`. Porém, a Z-API só dispara esses eventos se a opção **"Notificar mensagens enviadas por mim" (notifySentByMe)** estiver **ATIVA** no painel da instância. Se estiver desligada, qualquer mensagem enviada fora do sistema (celular/WhatsApp Web) é invisível para nós — não chega nenhum webhook.

2. **Outro canal Z-API:** cada canal tem seu próprio webhook e seu próprio registro de chat por (channel_id + phone). Mensagens de outro número Z-API hoje vão para outro chat, então o operador que olha o canal A não vê o que foi enviado pelo canal B, mesmo conversando com o mesmo cliente.

3. **E-mail / outros canais não-WhatsApp:** já existe `email_channels` mas as mensagens vivem em tabela separada e não são mescladas no painel do chat WhatsApp.

## Plano

### Etapa 1 — Garantir captura do "WhatsApp direto" (prioridade alta, resolve 90% do caso)

- Adicionar, na tela **Configurações → Z-API → Conexão**, um botão **"Ativar webhooks (recebidas + enviadas + status)"** que chama os endpoints da Z-API:
  - `PUT /webhooks/on-message-received` → URL do webhook
  - `PUT /webhooks/on-send` → URL do webhook (este é o que faltava)
  - `PUT /webhooks/on-message-status` → URL do webhook
  - `PUT /webhooks/notify-sent-by-me` com `value=true`
- Mostrar status atual (cada webhook ✅/❌) na mesma tela, lendo via `GET /webhooks`.
- Garantir que o webhook backend trate corretamente o evento `MessageSentCallback` para mensagens enviadas pelo celular do operador (já trata, só validar o caminho de rehost de mídia para áudio/imagem enviada de fora).
- Adicionar um log explícito quando recebermos `SentCallback` sem `chat_id` correspondente (cria novo chat se necessário, do lado correto).

### Etapa 2 — Unificar visualização entre canais Z-API diferentes (mesmo cliente, vários números)

- No painel de chat (`contact-history-panel`), agrupar histórico do **contato** (por telefone normalizado) somando mensagens de todos os `zapi_chats` daquele telefone, independente do `channel_id`.
- Manter o chat "ativo" por canal (resposta vai pelo canal certo), mas a aba **Histórico** mostra a linha do tempo unificada com badge indicando o canal de origem de cada mensagem.

### Etapa 3 — Mesclar e-mails no histórico do contato

- No `contact-history-panel`, adicionar uma aba ou misturar na timeline as mensagens de e-mail vinculadas ao mesmo contato (match por e-mail do contato).
- Cada item recebe um ícone (WhatsApp / E-mail) e o canal de origem.

### Etapa 4 — Validação

- Testar enviando uma mensagem do celular do operador (mesmo número Z-API) e confirmar que aparece em segundos no painel com `from_me=true`.
- Testar enviando do canal B e abrindo o chat no canal A do mesmo cliente — histórico unificado deve mostrar tudo.
- Conferir áudio/imagem enviado de fora (rehost de mídia para o bucket público).

## Detalhes técnicos

- **Arquivos afetados (Etapa 1):**
  - `src/components/configuracoes/zapi-connection-config.tsx` — nova UI e ação.
  - `src/lib/zapi.functions.ts` + `src/lib/zapi.server.ts` — `setZapiWebhooks(channelId)` e `getZapiWebhooks(channelId)`.
  - `src/routes/api.public.zapi-webhook.$channelId.tsx` — pequeno ajuste para criar chat quando recebemos `SentCallback` para um telefone ainda sem chat.
- **Arquivos afetados (Etapa 2/3):**
  - `src/components/central/contact-history-panel.tsx` — query agregada por phone (todos os channels) + merge com `email_messages`.
- **Sem mudanças de schema** necessárias na Etapa 1. Etapas 2 e 3 são apenas leitura.

## Sugestão de execução

Recomendo começar **só pela Etapa 1**, pois é o que resolve o caso "envio pelo WhatsApp e não aparece". Etapas 2 e 3 podemos fazer depois se você confirmar que precisa unificar canais diferentes.