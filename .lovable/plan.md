## Problemas

1. **Popover abre e fecha imediatamente** ao clicar em "Respostas rápidas" no menu de opções de envio do chat (`src/routes/central.tsx` ~linha 3178). Ao acionar `setQuickRepliesOpen(true)` dentro do `onSelect` do `DropdownMenuItem`, o fechamento do dropdown dispara um evento de `pointerdown`/foco fora que o `Popover` interpreta como "clique fora" e fecha em seguida.

2. Não existe um caminho rápido para o operador (atendente) criar/editar/excluir respostas rápidas a partir do próprio chat — hoje só admin/gestor acessam o card em `Configurações › Z-API`. A RLS de `zapi_quick_replies` já permite que qualquer usuário autenticado faça INSERT, edite as próprias/globais e exclua as próprias, então é apenas uma questão de UI.

## Mudanças

### 1. Corrigir o popover (`src/routes/central.tsx`)

- No `onSelect` do item "Respostas rápidas", trocar o `setQuickRepliesOpen(true)` síncrono por `setTimeout(() => setQuickRepliesOpen(true), 0)` (ou `requestAnimationFrame`) para abrir o popover **depois** do dropdown terminar de fechar, evitando o conflito de outside-click.

### 2. Botão "Gerenciar" dentro do popover (`src/components/central/quick-replies-popover.tsx`)

- Adicionar um rodapé fixo no `PopoverContent` com um botão **"Gerenciar respostas rápidas"** (ícone `Settings` ou `Pencil`), visível para todos os usuários autenticados.
- Ao clicar, abrir um `Dialog` (novo componente `QuickRepliesManagerDialog`) que reaproveita a lógica de CRUD já existente em `src/components/configuracoes/zapi-quick-replies-config.tsx`.

### 3. Novo componente `QuickRepliesManagerDialog`

Local: `src/components/central/quick-replies-manager-dialog.tsx`.

- Refatorar `zapi-quick-replies-config.tsx` extraindo o miolo (form + lista + mutations) em um componente reutilizável `QuickRepliesManager` (mesma pasta `configuracoes/` ou em `components/quick-replies/`), mantendo as mesmas queries (`["zapi-quick-replies"]`) para que **toda alteração feita pelo operador apareça instantaneamente** no card de configurações (e vice-versa) graças ao cache compartilhado do React Query.
- `ZapiQuickRepliesConfig` passa a ser um wrapper fino: `Card` + `QuickRepliesManager`.
- `QuickRepliesManagerDialog` é um `Dialog` que renderiza o mesmo `QuickRepliesManager` em formato modal, acionado pelo botão "Gerenciar" do popover.

### 4. Sem mudanças de backend

- RLS atual já cobre o caso de uso (qualquer usuário autenticado pode criar; só dono/global/admin/gestor pode editar; só dono/admin/gestor pode excluir). Nenhuma migration necessária.
- Mensagens de erro do `updateMutation`/`deleteMutation` já tratam "sem permissão" para o caso de um atendente tentar editar/excluir um item de outro usuário que não seja global.

## Fora de escopo

- Não alterar permissões de RLS.
- Não alterar variáveis dinâmicas, formatação `*negrito*`, nem o atalho `/`.
- Não tocar no popover do `floating-chat-window` (já funciona porque é acionado por botão visível, não por dropdown). Ele ganhará o botão "Gerenciar" automaticamente por compartilhar o `QuickRepliesPopover`.
