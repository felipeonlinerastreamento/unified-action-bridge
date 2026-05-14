## Objetivo

Adicionar um botão **"Histórico completo"** no header do chat ativo que abre um modal com **todas as mensagens já trocadas com aquele contato** (todos os chats, não só o atual) — estilo "ver histórico" do WhatsApp.

## Onde

- **Apenas no header do chat ativo** em `src/routes/central.tsx` (ao lado do nome/telefone do contato).

## UI do modal

Modal grande (`max-w-3xl`, altura ~85vh):

- Cabeçalho: avatar + nome + telefone + contagem ("X mensagens em Y atendimentos").
- Linha do tempo única, ordem cronológica ascendente.
- Separadores por **dia** (Hoje / Ontem / data) e, dentro do dia, separadores discretos por **chat/protocolo** (ex.: "— Atendimento #1234 —").
- Bolhas in/out com texto, mídia (imagem/áudio/documento), reply, status (✓✓), autor (quando for nossa).
- Reusa `MessageMedia` e `MessageStatusTicks` existentes.
- Paginação por blocos: carrega os 300 mais recentes; botão "Carregar mais antigas" no topo busca o próximo bloco usando cursor `created_at < ?`.
- Auto-scroll para o final ao abrir.

## Dados

- Normalizar telefone do contato (usa `normalize_zapi_phone` do banco via RPC ou replica em JS).
- `select id, status, created_at, closed_at, protocol_number from zapi_chats where channel_id = ? and contact_phone = <normalizado>`.
- `select * from zapi_messages where chat_id in (...) order by created_at desc limit 300 [+ .lt('created_at', cursor)]`.
- Reverte para asc na exibição.

## Arquivos

- Novo: `src/components/central/full-conversation-history-dialog.tsx` (Dialog + lista + paginação + render de bolha).
- Edit: `src/routes/central.tsx` — importar e adicionar botão `<History />` no header do chat ativo, controlado por `useState`.

Sem mudanças de banco, sem migrations.

## Validação

- Abrir em chat com vários atendimentos: vê todas as mensagens, separadas por dia e por protocolo.
- Abrir em contato novo: vê só as do chat atual.
- Mídias e replies aparecem corretamente.
- Botão "Carregar mais antigas" some quando não há mais.
