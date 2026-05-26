## Contexto Atual
- O header do chat na Central já exibe o protocolo (`#XXXXX`) ao lado do número do contato quando `currentTicket?.protocol_number != null`.
- O menu de opções de envio (dropdown com ícone `+` ao lado do input) contém: "Enviar sussurro" e "Interagir sem apelido".
- A rota `/atendimentos` não aceita parâmetros de busca; o detalhe de um ticket é aberto via estado local (`selected`).

## O que será feito

### 1. Mostrar protocolo no header do chat
O protocolo já é exibido na linha secundária (telefone/nome). Será movido para **ao lado do nome do contato** (linha principal), tornando-o mais visível, assim como solicitado.

### 2. Adicionar opção "Ir no Protocolo" no menu de opções de envio
No `DropdownMenu` de "Opções de envio" (ícone `+` ao lado do campo de mensagem), adicionar um novo item:
- **Visibilidade**: apenas quando `currentTicket?.protocol_number != null`.
- **Label**: "Ir no Protocolo" (com ícone `FileText`).
- **Ação**: navegar para `/atendimentos?ticket=<currentTicket.id>`.

### 3. Permitir abrir ticket por query param em `/atendimentos`
- Em `src/routes/atendimentos.tsx`: adicionar `validateSearch` aceitando `ticket?: string`.
- Em `src/components/atendimentos/atendimentos-content.tsx`: ler o search param `ticket`. Quando os tickets carregarem, se houver um `ticket` na URL, procurar o ticket com aquele ID e chamar `setSelected(ticket)`, abrindo automaticamente o painel de detalhes.

## Arquivos a serem alterados
- `src/routes/central.tsx`
- `src/routes/atendimentos.tsx`
- `src/components/atendimentos/atendimentos-content.tsx`

## Fora de escopo
- Nenhuma alteração no backend (DB, RLS, server functions).
- Nenhuma mudança no comportamento de finalização ou criação de tickets.