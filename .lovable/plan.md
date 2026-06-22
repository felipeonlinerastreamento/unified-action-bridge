# Ações de conversa nos cadastros de contato

Adicionar dois botões no topo dos diálogos de cadastro/edição de Técnico, Subcliente e Contato do CRM:

- **Histórico de conversa** — abre o `FullConversationHistoryDialog` já existente com todas as mensagens trocadas com aquele número (em qualquer protocolo/chat).
- **Iniciar conversa** — abre (ou cria) o chat na Central para aquele número e navega direto para `/central?chat=...&channel=...`.

Os botões ficam habilitados quando o formulário tem um telefone preenchido. No Técnico, usa `Telefone` (ou `Tel. do contato vinculado` como fallback). Em Subcliente e CRM, usa o `Telefone` do contato.

## Componente compartilhado

Novo `src/components/contatos/contact-chat-actions.tsx` exportando `<ContactChatActions phone name />`:

- Botão "Histórico de conversa": ao clicar, resolve o último `zapi_chats` para o telefone (mesmo padrão usado em `ticket-detail-panel.goToChat`: `ilike phone %slice(-10)%`, mais recente). Se achar, abre `FullConversationHistoryDialog` com `channelId`, `contactPhone`, `contactName`. Se não achar, mostra toast "Nenhuma conversa encontrada para este número".
- Botão "Iniciar conversa": replica `startChatFromTicket` (sem vínculo a ticket). Procura chat existente; se houver, navega; se não, escolhe canal ativo via `rpc('list_channels_safe')` e cria novo `zapi_chats` com `status='em_atendimento'`, `assigned_to = auth user`, depois navega para `/central?chat=...&channel=...` e fecha o diálogo pai (via prop `onNavigate?: () => void`).

Permissão: qualquer usuário autenticado (mesmo padrão da Central).

## Integração nos diálogos

1. **`src/components/contatos/technicians-admin.tsx`** — renderizar `<ContactChatActions>` no topo do conteúdo dos dois Dialogs (novo e editar). Telefone = `form.phone || form.contact_phone`. `onNavigate` fecha o diálogo.

2. **`src/components/contatos/sub-clients-admin.tsx`** — renderizar no topo do Dialog. Telefone = `form.phone`. `onNavigate` fecha o diálogo.

3. **`src/routes/crm.tsx`** — renderizar logo abaixo de `DialogHeader` no Dialog de contato. Telefone = `form.phone`. `onNavigate` fecha o diálogo.

## Arquivos

- novo: `src/components/contatos/contact-chat-actions.tsx`
- editar: `src/components/contatos/technicians-admin.tsx`
- editar: `src/components/contatos/sub-clients-admin.tsx`
- editar: `src/routes/crm.tsx`

Sem alterações de banco/RLS — usa tabelas e RPC já existentes.
