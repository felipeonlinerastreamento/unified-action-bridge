# Plano: identificar mensagens do robô no chat

## Objetivo
Quando uma mensagem for enviada pelo robô de atendimento, exibir o texto **"(Mensagem automática)"** ao lado do nome do operador no chat, apenas para visualização interna (operadores e administradores).

## Como será feito

### 1. Marcar mensagens do robô no banco
- Adicionar coluna `is_bot_message` (boolean, default `false`) na tabela `zapi_messages`.
- Aplicar GRANTs de uso (`authenticated` e `service_role`).
- Atualizar `src/lib/bot-auto-reply.server.ts` para inserir `is_bot_message: true` nas mensagens enviadas pelo robô.

### 2. Expor a flag no retorno das mensagens
- Atualizar `getChatMessages` em `src/lib/zapi.functions.ts` para incluir `isBotMessage` no objeto retornado.
- Ajustar as interfaces `GMessage` em `src/routes/central.tsx` e `src/components/central/floating-chat-window.tsx`.
- Atualizar os tipos gerados do Supabase (`src/integrations/supabase/types.ts`).

### 3. Renderizar no chat
- Em `src/routes/central.tsx`: quando `isBotMessage` for true, acrescentar ` (Mensagem automática)` ao lado do nome do operador no cabeçalho da bolha.
- Em `src/components/central/floating-chat-window.tsx`: aplicar o mesmo comportamento nas janelas flutuantes.
- Manter a cor/estilo da bolha inalterada para não confundir o operador.

### 4. Verificação
- Rodar `tsgo` e validar o build.
- Verificar se mensagens antigas continuam aparecendo normalmente (ficam sem a marcação).
- Validar que mensagens enviadas pelo operador não ganham o selo.

## Escopo
Apenas a visualização interna do chat será alterada. O cliente final não vê nenhuma diferença.
