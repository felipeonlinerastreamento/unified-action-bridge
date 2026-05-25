## Chat interno com operadores (a partir das Notificações)

### Resumo
Adicionar um novo tipo de "Notificação → Chat com operador(es)" na tela `Configurações › Notificações`, que cria conversas persistentes em tempo real entre quem envia (Admin/Gestor) e os destinatários (pessoa/setor/grupo/todos). Opcionalmente, o destinatário fica com modal fullscreen bloqueante até enviar a primeira resposta.

### Banco de dados (nova migration)

Tabelas novas:
- `operator_chats` — uma conversa por destinatário (thread 1-a-1 entre o remetente e cada operador).
  - campos: `id`, `campaign_id` (opcional, agrupa o broadcast), `created_by`, `created_by_name`, `recipient_user_id`, `subject` (título), `lock_until_reply` (bool), `is_locked` (bool — true até o destinatário responder), `last_message_at`, `closed_at`, `created_at`, `updated_at`.
- `operator_chat_messages` — mensagens da thread.
  - campos: `id`, `chat_id`, `sender_user_id`, `sender_name`, `body` (text), `created_at`, `read_at`.

RLS:
- `operator_chats`: SELECT/UPDATE permitido para `created_by = auth.uid()` OR `recipient_user_id = auth.uid()` OR `has_role(auth.uid(),'admin')`. INSERT só Admin/Gestor.
- `operator_chat_messages`: SELECT/INSERT só para participantes (créator ou recipient do chat pai), via função `is_operator_chat_participant(_user_id, _chat_id)` (SECURITY DEFINER, evita recursão de RLS).

Trigger:
- Em `INSERT` numa `operator_chat_messages`: se `sender_user_id = chat.recipient_user_id` e `chat.is_locked = true` → marca `is_locked = false` (libera modal). Sempre atualiza `last_message_at`.

Realtime: `ALTER PUBLICATION supabase_realtime ADD TABLE operator_chats, operator_chat_messages;`

### UI

1. **`configuracoes.notificacoes.tsx` — Nova Notificação**
   - Adicionar Tabs no topo do card: `Notificação` (atual) | `Chat com operador(es)`.
   - Aba Chat reaproveita seletor Destinatário (Pessoa/Setor/Grupo/Todos), Título e Mensagem inicial.
   - Toggle "Bloquear tela do destinatário até ele responder" (default ON).
   - Botão "Iniciar chat": cria 1 linha em `operator_chats` por destinatário (com `is_locked = lock_until_reply`) e insere a mensagem inicial em `operator_chat_messages`.

2. **`notifications-bell.tsx` (sino)**
   - Adicionar nova aba/seção "Conversas" com lista de `operator_chats` onde o usuário é participante (recipient OU creator) e `closed_at IS NULL`, ordenadas por `last_message_at`. Badge no sino soma não-lidas de notificações + mensagens não-lidas em chats.
   - Click numa conversa abre `OperatorChatDialog`.

3. **`OperatorChatDialog` (novo componente)**
   - Dialog estilo chat: header com nome do outro participante, lista de mensagens (subscrição realtime em `operator_chat_messages` por `chat_id`), input no rodapé, botões "Fechar conversa" (apenas creator) e "Minimizar".

4. **`OperatorChatLockOverlay` (novo, montado no `__root.tsx` ao lado de `NotificationPopup`)**
   - Query: `operator_chats` onde `recipient_user_id = me AND is_locked = true AND closed_at IS NULL`, com realtime.
   - Quando existir 1+ → renderiza `<Dialog open>` fullscreen, NÃO dispensável (bloqueia outside/escape), mostrando histórico do chat + input. Ao enviar a 1ª resposta, o trigger libera `is_locked` e o overlay desmonta automaticamente.

### Permissões
- Tela de criar chat: continua restrita pelo acesso atual a `Configurações › Notificações` (Admin/Gestor).
- Sino e overlay: qualquer usuário autenticado pode ver/responder chats em que é participante.

### Verificação
1. Admin cria chat para um operador X com lock ON → operador X vê modal fullscreen bloqueante imediatamente (realtime).
2. Operador X responde → modal fecha sozinho; conversa permanece acessível pelo sino.
3. Admin recebe a resposta em realtime na conversa.
4. Broadcast para Setor cria 1 thread por integrante; cada um vê e responde individualmente.
5. RLS impede que terceiros leiam threads alheias.

### Arquivos previstos
- Migration SQL (tabelas, RLS, função, trigger, realtime).
- `src/components/operator-chat/operator-chat-dialog.tsx` (novo)
- `src/components/operator-chat/operator-chat-lock-overlay.tsx` (novo)
- `src/components/operator-chat/operator-chat-list.tsx` (novo — usado no sino)
- `src/components/notifications-bell.tsx` (editado — abas Notificações/Conversas + badge combinada)
- `src/routes/configuracoes.notificacoes.tsx` (editado — tabs + form de chat)
- `src/routes/__root.tsx` (editado — montar `OperatorChatLockOverlay`)
