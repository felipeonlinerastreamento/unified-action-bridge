# Limpeza do histórico e visão de admin no Chat com Operadores

## 1. Manter só as 5 últimas mensagens de cada conversa (uma vez)

Limpeza única: em cada conversa entre operadores, apagar todas as mensagens
exceto as 5 mais recentes. Conversas com 5 mensagens ou menos ficam intactas.

- Antes de apagar, mostro quantas mensagens serão removidas e quantas ficam.
- A exclusão é definitiva (não há lixeira).
- Nenhuma conversa é encerrada ou removida; só as mensagens antigas somem.

## 2. Admin passa a ver todas as conversas

Hoje a tela lista só as conversas de que a pessoa participa, mesmo sendo admin.

- Para quem é admin, a lista passa a trazer todas as conversas entre operadores
  (abertas e encerradas), com um seletor "Minhas conversas / Todas".
- Ao abrir uma conversa da qual o admin não participa, ele lê o histórico
  normalmente; o campo de envio continua disponível apenas nas conversas dele.
- Nada muda para os demais operadores.

## Detalhes técnicos

- Limpeza: `DELETE` em `operator_chat_messages` via run_sql, preservando as 5
  linhas mais recentes por `chat_id` (`row_number() over (partition by chat_id
  order by created_at desc) <= 5`). Sem alteração de schema.
- Visão admin: em `src/routes/chat-operadores.tsx`, quando `hasRole("admin")` e o
  modo "Todas" estiver ativo, a consulta a `operator_chats` dispensa o filtro
  `myChatsOrFilter`. As policies já permitem leitura ampla para admin
  (`has_role(auth.uid(),'admin')` em `operator_chats`,
  `operator_chat_messages` e `operator_chat_participants`), então não há
  mudança de banco.
- Em `src/components/operator-chat/operator-chat-panel.tsx`, esconder o compositor
  quando o admin não for criador/destinatário/participante da conversa aberta.
