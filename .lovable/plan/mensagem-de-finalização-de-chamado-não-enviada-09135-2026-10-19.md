# Mensagem de finalização de chamado não enviada (#09135)

## Motivo (confirmado)
- O protocolo #09135 foi finalizado às 10:56. Nenhuma mensagem saiu para o cliente depois disso.
- O Robô de Atendimento está **inativo**. Hoje, com o robô inativo, o sistema bloqueia todas as mensagens automáticas, inclusive a de finalização e a pesquisa de satisfação.
- A mensagem de fora de horário já foi separada do robô antes. A de finalização ficou presa à mesma trava.

## O que muda
- A mensagem de finalização e a pesquisa de satisfação passam a ser enviadas mesmo com o robô inativo.
- O robô inativo continua bloqueando só as respostas automáticas da conversa (saudação, automações, "ainda está aí?").
- Continua igual: quando a pesquisa de satisfação está ativa, só ela é enviada (já avisa o encerramento). "A resolver" e a opção do admin de não enviar mensagem seguem sem envio.
- O aviso na tela do Robô passa a deixar claro que finalização e pesquisa não dependem dele.

## Detalhes técnicos
- `src/routes/central.tsx` (~2515-2530): remover a checagem `bot_auto_reply_settings.is_enabled` do fluxo de finalização.
- Conferir se o webhook bloqueia a captura da resposta da pesquisa (`csat_pending`) quando o robô está inativo. Se bloquear, liberar essa captura também.
- Ajustar o texto do alerta em Configurações → Robô de Atendimento.
- Publicar para valer no site.
