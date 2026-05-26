## Objetivo

No painel de detalhes de um chamado (menu **Atendimentos**), adicionar a opção **"Iniciar atendimento"** ao lado do botão atual "Ir para conversa". Ao clicar, abre uma conversa na Central com o telefone do contato do chamado, e essa conversa fica **vinculada ao mesmo chamado/protocolo** já aberto — para que mensagens trocadas e a eventual finalização do chat se refiram ao mesmo protocolo.

## Comportamento

Arquivo: `src/components/atendimentos/ticket-detail-panel.tsx`

1. Mostrar o botão **Iniciar atendimento** somente quando `ticket.contact_phone` existir e `ticket.status` for diferente de `finalizado`.
2. Fluxo do botão (`startChatFromTicket`):
   a. Normalizar o telefone (mesmo padrão usado em `goToChat`).
   b. Procurar `zapi_chats` por `phone_normalized` (LIKE) para reaproveitar a conversa existente.
   c. Se **não existir** chat:
      - Pegar o canal ativo (via `list_channels_safe`). Se houver mais de um, usar o primeiro ativo; se nenhum canal ativo for encontrado, mostrar `toast.error("Nenhum canal disponível para iniciar conversa")`.
      - Inserir um novo `zapi_chats` com: `channel_id`, `phone`, `contact_name = ticket.contact_name`, `status = 'em_atendimento'`, `assigned_to = auth.uid()`, `pending_resolve_ticket_id = ticket.id`.
   d. Se **existir** chat:
      - Atualizar `pending_resolve_ticket_id = ticket.id` e `pending_resolve_at = now()` para fixar o vínculo com o protocolo aberto.
      - Se o chat estiver `aguardando` ou sem dono, atribuir ao usuário atual e marcar `status = 'em_atendimento'`.
   e. Navegar para `/central` com `{ chat: <id>, channel: <channel_id> }` e fechar o painel.
3. Adicionar `toast.success("Atendimento iniciado vinculado ao protocolo #XXXX")` usando `formatTicketProtocol(ticket)`.

## Como o vínculo com o protocolo é respeitado

`zapi_chats.pending_resolve_ticket_id` já é o campo usado pela Central (`src/routes/central.tsx` e o webhook em `api.public.zapi-webhook.$channelId.tsx`) para reaproveitar um ticket existente como "protocolo do chat". Ao defini-lo manualmente nesse fluxo, o chat herda o mesmo `protocol_number` do chamado aberto e a finalização posterior atualiza esse mesmo ticket em vez de criar um novo.

## Fora do escopo

- Não vou alterar a Central nem o webhook.
- Não vou criar nova migração — `pending_resolve_ticket_id` e demais campos já existem.
- Não toco em RLS (políticas de INSERT/UPDATE em `zapi_chats` já permitem usuário autenticado).
