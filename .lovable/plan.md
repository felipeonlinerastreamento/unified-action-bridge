# Robô inativo = silêncio total

## O que está acontecendo

O Robô de Atendimento está realmente desligado (e em modo observação), então ele não enviou nada. As mensagens que o cliente recebeu vieram de outras automações, que hoje funcionam de forma independente:

- Mensagem de fora do horário ("no momento estamos offline...") — saiu hoje às 07:32 e 07:39 para dois contatos, **duas vezes seguidas em 6 segundos** para o mesmo número.
- Menu automático de opções (fluxo de perguntas do WhatsApp), que roda sempre que o robô não responde.
- Cobrança de inatividade a cada 10 minutos ("ainda está aí?").
- Pesquisa de satisfação ao finalizar o atendimento (nota 1/2/3).

Ou seja: desligar o robô hoje apenas faz o sistema cair no menu automático, em vez de calar tudo.

## O que será feito

1. **Chave geral de silêncio**: quando o Robô de Atendimento estiver inativo, nenhuma mensagem automática é enviada — nem fora do horário, nem menu de opções, nem cobrança de inatividade, nem pesquisa de satisfação. O cliente só recebe resposta de uma pessoa.
2. **Aviso claro na tela** do Robô de Atendimento: quando desligado, um alerta informando que TODAS as respostas automáticas do WhatsApp ficam suspensas.
3. **Fim da mensagem duplicada** de fora do horário: apenas um envio por contato dentro do intervalo configurado, mesmo quando chegam várias mensagens juntas.
4. Nada muda quando o robô está ligado: todas as automações continuam funcionando como hoje.

## Detalhes técnicos

- Novo helper em `src/lib/bot-auto-reply.server.ts`: `isAutoReplyGloballyEnabled()` (lê `bot_auto_reply_settings.is_enabled`, com cache curto; em caso de erro assume habilitado para não quebrar o fluxo atual).
- `src/routes/api.public.zapi-webhook.$channelId.tsx`: buscar o estado uma vez por mensagem recebida e, quando desligado, pular o bloco de fora do horário, `evaluateInboundForAutoReply`, `processIncomingForBot` e o envio da pesquisa de satisfação (linha ~723) — mantendo a persistência da mensagem, atribuição de fila e status do chat intactos.
- `src/routes/api.public.chat-idle-scanner.tsx`: sair sem enviar quando o robô estiver desligado.
- Duplicidade: `shouldSendOutOfHoursMessage` passa a registrar o log de envio (`out_of_hours_message_log`) antes do disparo e a consultar o cooldown de forma atômica por telefone, evitando duas checagens simultâneas aprovarem o mesmo envio.
- `src/components/configuracoes/bot-auto-reply-config.tsx`: alerta explicando o alcance do desligamento.
