# Fazer o "X" do aviso de conversa funcionar

## Causa provável
- O "X" só esconde o aviso na tela atual, sem registrar nada. Se há vários avisos acumulados, o próximo aparece no mesmo lugar e parece que o "X" não funcionou; ao recarregar a página, todos voltam.
- Quando outra janela do sistema está aberta, o aviso também pode ficar sem responder aos cliques (mesmo problema corrigido no aviso de chamado).

## Correção
- Ao clicar no "X", o aviso fica marcado como visto e não volta mais (nem ao recarregar).
- Se houver mais avisos na fila, mostrar "1 de N" e um link "Fechar todos".
- Garantir que o aviso sempre aceite cliques, mesmo com outra janela aberta.

## Detalhes técnicos
- `src/components/message-trigger-alert.tsx`: o botão X grava `acknowledged_at` (como o botão "Visto") e o `localStorage` de visto; adicionar `pointer-events-auto` no cartão e no overlay; contador e ação "Fechar todos" para os não bloqueantes pendentes.
- Verificar com Playwright clicando no X.
