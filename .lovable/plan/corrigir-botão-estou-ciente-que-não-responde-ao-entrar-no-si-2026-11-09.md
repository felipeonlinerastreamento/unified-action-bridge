# Corrigir botão "Estou ciente" que não responde ao entrar no sistema

## Causa
Ao entrar, a Andreia recebe ao mesmo tempo o aviso de outra notificação (janela de notificações do sistema). Enquanto essa janela está aberta, ela bloqueia os cliques no resto da página. O aviso de novo chamado aparece na frente, mas herda esse bloqueio — por isso os botões não respondem.

## Correção
- Forçar o aviso de novo chamado a sempre aceitar cliques, mesmo com outra janela aberta por trás.
- Enquanto o aviso de novo chamado estiver na tela, adiar a outra janela de notificação; ela aparece logo depois do "OK".

## Detalhes técnicos
- `src/components/ticket-assignment-alert.tsx`: adicionar `pointer-events-auto` (e `style={{ pointerEvents: "auto" }}`) no overlay e no cartão; o Radix Dialog de `notification-popup.tsx` aplica `pointer-events: none` no `body`, que o overlay (fora do portal Radix) herda.
- Expor um sinal simples (ex.: atributo `data-ticket-alert-open` no `document.body` ou evento) e fazer `notification-popup.tsx` não abrir enquanto ele estiver ativo.
- Verificar com Playwright abrindo os dois avisos juntos e clicando em "OK, estou ciente".
