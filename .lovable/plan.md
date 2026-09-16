# Robô não respondeu o contato

## O que os registros mostram

Às 09:31 (horário de Brasília) o robô reconheceu a mensagem "Oi" e escolheu a resposta "Saudação sem assunto" — mas gravou o resultado como **simulado**, ou seja, ele só anotou o que responderia e não enviou nada.

Motivo: o robô está com o **modo observação ligado** (ele fica ligado, porém calado). Além disso:

- As mensagens de áudio e imagem do mesmo contato foram registradas como "não reconhecidas" — hoje o robô só entende texto.
- O robô está com limite de 2 respostas por conversa e janela de 08:00 às 18:00, o que está correto para o caso.

## O que fazer

1. Desligar o modo observação nas configurações do Robô de Atendimento, para que ele passe a enviar de verdade.
2. Manter o restante como está (espera de 10 segundos, horário 08:00–18:00, limite de 2 respostas, não responder quando já existe chamado aberto).
3. Depois de desligar, mandar um "Oi" pelo WhatsApp desse contato e conferir na tela de configuração se o registro aparece como "enviado" em vez de "simulado".

## Melhoria opcional (mesmo ajuste)

Quando o cliente inicia com áudio ou imagem, o robô hoje fica em silêncio. Posso fazer com que, nesses casos, ele use a resposta de saudação (pedindo o assunto por texto), evitando que o cliente fique sem retorno.

## Detalhes técnicos

- `bot_auto_reply_settings.observe_only` está `true`; mudar para `false` (pela tela de configuração, que já grava esse campo).
- Para a melhoria opcional: em `src/lib/bot-auto-reply.server.ts`, quando `incomingText` for um marcador de mídia (`[áudio]`, `[imagem]`, etc.), usar a regra com `is_greeting = true` em vez de registrar `unmatched`.
