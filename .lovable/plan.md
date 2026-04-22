

# Janelas flutuantes de chat na Central de Atendimento

## Objetivo

Permitir que o operador **arraste qualquer atendimento da fila** para fora e o transforme numa **janela flutuante de conversa**, podendo abrir várias ao mesmo tempo, movê-las pela tela, minimizar/maximizar e responder em paralelo — sem precisar trocar o "chat selecionado" do painel principal.

---

## Comportamento

1. **Iniciar arraste**: cada item da lista (`ChatListItem`) recebe `draggable=true`. Ao começar a arrastar, exibe um "ghost" com avatar + nome.
2. **Soltar em qualquer lugar da tela**: ao soltar fora do painel da fila, é aberta uma **janela flutuante de chat** posicionada onde o cursor soltou.
3. **Janela flutuante**: caixa ~380×520, com barra de título arrastável (mesma mecânica do `ai-floating-assistant.tsx`):
   - Avatar + nome + telefone
   - Badge de SLA (mesma cor do item da fila)
   - Botões: **Minimizar** (vira pílula no canto inferior direito), **Maximizar/Restaurar**, **Fechar**
4. **Conteúdo da janela**:
   - Histórico de mensagens (poll a cada 5s — mesmo padrão atual)
   - Campo de input + botão Enviar
   - Botões rápidos no rodapé: **Finalizar**, **Transferir**, **Abrir no painel principal** (re-seleciona o chat no painel central)
5. **Múltiplas janelas**: cada chat aberto = uma janela independente. Janelas minimizadas empilham como pílulas no canto inferior direito (offset horizontal de 220px cada).
6. **Foco/z-index**: clicar numa janela traz para frente (incrementa z-index).
7. **Persistência da sessão**: lista de chats abertos + posições + estado (minimizado/maximizado) ficam em `localStorage` (`gsystem-floating-chats`) para sobreviver a refresh.
8. **Notificação de nova mensagem**: se uma janela minimizada recebe mensagem nova (poll detecta `countUnreadMessages` aumentou), a pílula pulsa e mostra contador.
9. **Limite**: máximo de 6 janelas abertas simultaneamente (toast avisa quando exceder); janelas minimizadas não contam no limite visual de empilhamento mas contam no total.

---

## Arquitetura

### Novo contexto global: `FloatingChatsProvider`
`src/components/central/floating-chats-context.tsx`
- Estado: `Array<{ chatId, channelId, position, size, minimized, maximized, zIndex }>`
- Métodos: `openChat`, `closeChat`, `minimize`, `maximize`, `restore`, `bringToFront`, `updatePosition`
- Persiste em localStorage
- Provider envolve a página `/central` (em `src/routes/central.tsx`)

### Nova janela flutuante: `FloatingChatWindow`
`src/components/central/floating-chat-window.tsx`
- Recebe `chatId`, `channelId` por props
- Reutiliza as mesmas server functions já existentes: `getChatDetail`, `getChatMessages`, `sendText`, `finalizeChat`, `transferChat` (de `src/lib/gsystem.functions.ts`)
- Reutiliza `useQuery` com `refetchInterval: 5000` (mesmo padrão de `central.tsx`)
- Drag-to-move com `mousedown` + `mousemove` listeners (mesmo padrão do `ai-floating-assistant.tsx`)
- Renderizada em `position: fixed` no portal do `body`

### Container das janelas: `FloatingChatsLayer`
`src/components/central/floating-chats-layer.tsx`
- Lê o estado do contexto e renderiza N `<FloatingChatWindow>`
- Renderiza também a "doca" de janelas minimizadas no canto inferior direito
- Adicionado UMA vez no `central.tsx` (após o conteúdo principal)

### Drag source na lista
Em `src/components/central/chat-queue-list.tsx`:
- `ChatListItem` recebe `draggable` + handlers `onDragStart` (seta `dataTransfer` com `chatId`) e `onDragEnd`
- No `onDragEnd`, se `e.dataTransfer.dropEffect === "none"` (soltou fora de uma drop zone), abrir a janela flutuante via contexto, na posição `e.clientX/e.clientY`

---

## Sumário de arquivos

### Criar
- `src/components/central/floating-chats-context.tsx` — Provider + hook `useFloatingChats()`
- `src/components/central/floating-chat-window.tsx` — janela individual (drag, resize de cabeçalho, mensagens, envio, ações)
- `src/components/central/floating-chats-layer.tsx` — renderiza todas as janelas + doca de minimizadas

### Editar
- `src/routes/central.tsx` — envolver com `<FloatingChatsProvider>` e adicionar `<FloatingChatsLayer />` ao final
- `src/components/central/chat-queue-list.tsx` — adicionar `draggable`, `onDragStart`, `onDragEnd` em `ChatListItem`; consumir `useFloatingChats()` para abrir janela ao soltar fora

---

## Detalhes técnicos

- **Drag nativo HTML5** (`draggable=true` + `onDragStart/onDragEnd`) para iniciar o "puxe para fora"; **listener `mousedown` customizado** dentro da janela para mover (mesmo padrão de `ai-floating-assistant.tsx`).
- **Detecção de "soltou fora"**: usar `e.dataTransfer.dropEffect === "none"` no `onDragEnd` (browser seta automaticamente quando não houve drop válido) + checar se as coordenadas estão fora do `<aside>` da lista de fila.
- **Posição inicial**: `{ x: e.clientX - 50, y: e.clientY - 30 }` clampado dentro da viewport.
- **Z-index**: contador global no contexto; `bringToFront` incrementa e atribui à janela clicada.
- **Doca de minimizados**: `position: fixed; bottom: 16px; right: 16px;` com `flex gap-2`; cada pílula 200×40 com avatar + nome + contador de não-lidas.
- **Persistência**: ao montar o provider, hidrata do localStorage; salva em `useEffect` com debounce 300ms.
- **Reaproveitamento**: nenhuma nova chamada à API GSystem — todas as funções de `src/lib/gsystem.functions.ts` já existem e são chamadas exatamente como o painel principal hoje.
- **Não interfere no painel principal**: o `selectedChatId` continua funcionando; o usuário pode ter um chat ativo no painel + várias janelas flutuantes simultâneas.
- **Mobile**: em `useIsMobile()` (já existe), as janelas viram fullscreen (modal) e a doca empilha verticalmente — drag fica desativado.

