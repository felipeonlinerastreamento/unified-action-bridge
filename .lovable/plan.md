# Mensagem de fora de horário em grupos de WhatsApp

## Motivo
A mensagem de fora de horário é enviada só em conversas individuais. Grupos ficaram de fora de propósito, para o robô não responder a cada mensagem trocada entre os participantes. Por isso o grupo "Via tecnologia ONLINE" não recebeu nada depois das 18:00.

## O que muda
- Nova opção em Z-API & Bot → Horário de Funcionamento: "Enviar mensagem de fora de horário também em grupos" (desligada por padrão).
- Com a opção ligada, o grupo recebe a mensagem de ausência quando um cliente escreve fora do horário.
- Limite de repetição (cooldown) por grupo inteiro, não por participante. Assim o grupo recebe a mensagem uma vez por janela, mesmo que várias pessoas escrevam.
- Mensagens enviadas pela equipe dentro do grupo não disparam o aviso.

## Detalhes técnicos
- Coluna `apply_to_groups boolean default false` em `business_hours_settings`.
- Webhook (linha ~1328): trocar `!isGroupMessage` por `(!isGroupMessage || bh.apply_to_groups)`; para grupo usar o ID do grupo como chave do cooldown em `out_of_hours_message_log`.
- `loadBusinessHoursSettings` e `BusinessHoursForm` passam a ler/gravar o novo campo.
- Publicar para valer no site.
