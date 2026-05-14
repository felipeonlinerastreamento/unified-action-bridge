## Causa

No chat (`src/routes/central.tsx` ~linhas 2912–3060), quando o "modo apelido" está ligado a mensagem é enviada com o prefixo `*Ricardo:* texto` (linha 2200) — isso é necessário para o WhatsApp do cliente exibir o nome em negrito.

Porém, no nosso painel a mesma mensagem renderiza:

1. O rótulo de operador acima da bolha (linha 3027–3034: `<strong>Ricardo</strong>`).
2. O corpo da mensagem cru (linha 3044), que ainda contém `*Ricardo:*` literal — daí o nome aparecer duas vezes (uma como `Ricardo` em negrito e outra como `*Ricardo:*` com asteriscos).

## Correção

Em `src/routes/central.tsx`, no map de `messages` (~linha 3043):

- Detectar prefixo de apelido `^\*([^*\n]+):\*\s+` no `msg.text` quando `isMe`.
- Renderizar `msg.text` sem esse prefixo (apenas para exibição local).
- Manter o rótulo `<strong>{senderFirstName}</strong>` acima da bolha como única indicação do operador.
- O texto enviado/armazenado segue inalterado, então no WhatsApp do contato o nome continua em negrito (`*Ricardo:*`).

Sem mudanças em envio, banco ou markdown global.

## Validação

- Mensagem enviada com modo apelido: aparece só uma vez "Ricardo" no painel; no WhatsApp do contato continua negrito.
- Mensagem sem prefixo: comportamento inalterado.
- Notas privadas e mensagens recebidas: inalteradas.
