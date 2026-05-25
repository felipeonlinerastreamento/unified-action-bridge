# Tela de chat com operadores

Hoje o chat com operadores existe apenas como:
- Botão "Iniciar chat com operadores" em `Configurações > Notificações > Chat com operadores`
- Lista compacta dentro do sino de notificações (`OperatorChatList` no `notifications-bell`)
- Dialog modal (`OperatorChatDialog`) para conversar

Falta uma tela cheia para conversar de forma confortável, ver histórico e alternar entre conversas.

## O que será criado

Nova rota **`/chat-operadores`** com layout estilo WhatsApp:

```text
+-------------------------------------------------------+
| AppLayout (sidebar do sistema)                        |
| +--------------------+------------------------------+ |
| | Conversas          | Cabeçalho da conversa        | |
| | [busca]            | (nome do operador, status)   | |
| | + Nova conversa    +------------------------------+ |
| |                    |                              | |
| | • Conversa 1  (3)  |     Mensagens                | |
| | • Conversa 2       |     (bolhas)                 | |
| | • Conversa 3       |                              | |
| |                    +------------------------------+ |
| | [Encerradas ▾]     | [campo de mensagem] [enviar] | |
| +--------------------+------------------------------+ |
+-------------------------------------------------------+
```

### Painel esquerdo (lista)
- Reaproveita a query do `OperatorChatList` (conversas abertas) e adiciona seção "Encerradas" colapsável (filtra por `closed_at != null`).
- Campo de busca por assunto ou nome do operador.
- Botão "Nova conversa" no topo abre o mesmo seletor de operadores usado no `StartOperatorChatCard` (extraído para componente reutilizável).
- Badge de não lidas por conversa; conversa ativa destacada.

### Painel direito (conversa)
- Reaproveita o conteúdo do `OperatorChatDialog` (mensagens, envio, marcação de lida, lock overlay), extraindo o corpo para `OperatorChatPanel` para ser usado tanto no dialog quanto na nova tela.
- Quando nenhuma conversa selecionada: estado vazio com instrução.
- Atualização em tempo real via Realtime já existente.

### Acesso
- Item no menu lateral "Chat com operadores" (ícone `MessageCircle`), visível para todos os papéis (admin, gestor, atendente).
- Sino de notificações continua funcionando; clicar numa conversa lá pode redirecionar para `/chat-operadores?chat=<id>` (mantendo o dialog também como fallback rápido).

## Detalhes técnicos

- Arquivos novos:
  - `src/routes/chat-operadores.tsx` — rota com `AppLayout` e layout em 2 colunas
  - `src/components/operator-chat/operator-chat-panel.tsx` — corpo de conversa extraído do dialog
  - `src/components/operator-chat/new-operator-chat-button.tsx` — botão + popover de seleção de destinatários (extraído de `StartOperatorChatCard`)
- Arquivos alterados:
  - `src/components/operator-chat/operator-chat-dialog.tsx` — passa a usar `OperatorChatPanel`
  - `src/components/operator-chat/operator-chat-list.tsx` — aceita prop opcional `onSelectChat` para navegação (sem quebrar uso no sino)
  - `src/components/app-sidebar.tsx` (ou equivalente) — adiciona item "Chat com operadores"
- Sem mudanças de schema; usa tabelas existentes `operator_chats` e `operator_chat_messages` e suas RLS.
- Sincronização do parâmetro `?chat=<id>` na URL via `useNavigate` para deep-link.
