# Chat: abrir sempre na última mensagem + botão "ir para o fim"

## Objetivo
Ao clicar em uma conversa na Central de Atendimento, ela deve abrir já posicionada na mensagem mais recente. Além disso, um botão flutuante permite voltar ao fim da conversa sem rolar manualmente.

## Diagnóstico
- A lista de mensagens é ordenada cronologicamente (antigas no topo, recentes embaixo) e o container abre no topo por padrão.
- O auto-scroll atual (`scrollIntoView({ behavior: "smooth" })` em `src/routes/central.tsx` ~linha 1842) é suave e pode ser interrompido por re-renderizações/atualizações de polling, deixando a conversa parada nas mensagens antigas.
- Não existe controle para pular direto ao fim.

## Implementação

### 1. Scroll instantâneo ao abrir/trocar de conversa
- Em `src/routes/central.tsx`, ao mudar `selectedChatId`, rolar o viewport do `ScrollArea` diretamente para o fim (`scrollTop = scrollHeight`), de forma instantânea (sem `smooth`), após a renderização das mensagens (usar `requestAnimationFrame` ou pequeno timeout para garantir que o DOM já contém as mensagens).
- Mensagens novas recebidas continuam rolando para o fim apenas se o usuário já estiver perto do fim; se estiver lendo o histórico, não puxar.

### 2. Botão flutuante "Ir para a última mensagem"
- Botão redondo com ícone de seta para baixo, posicionado no canto inferior direito da área de mensagens.
- Visível somente quando o usuário não está no fim da conversa (detectar via `onScroll` do viewport).
- Ao clicar, rola suavemente até a mensagem mais recente e esconde o botão.
- Opcional: mostrar contador de mensagens novas enquanto o usuário está fora do fim.

### 3. Janela flutuante de chat
- Aplicar o mesmo comportamento em `src/components/central/floating-chat-window.tsx` (abrir no fim + botão de ir ao fim), mantendo consistência.

## Arquivos
- `src/routes/central.tsx` — efeito de auto-scroll e botão flutuante na área de mensagens.
- `src/components/central/floating-chat-window.tsx` — mesmo comportamento na janela flutuante.

## Verificação
- `tsgo` sem erros; build OK.
- Teste visual via Playwright: abrir conversa com histórico longo, confirmar que abre no fim; rolar para cima, confirmar que o botão aparece e que clicar volta ao fim.
