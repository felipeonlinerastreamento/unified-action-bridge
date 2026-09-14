# Notificação bloqueante ao mencionar o número 3136232190

## Objetivo

Quando alguém mencionar (`@`) o número **3136232190** em qualquer conversa (individual ou grupo), todos os usuários do setor **Atendimento** recebem a mesma notificação dos gatilhos por palavra-chave — só que essa notificação **trava a tela** e só libera depois que o operador confirmar.

## O que será feito

1. **Nova opção nos gatilhos** (Configurações > Z-API & Bot > Gatilhos por palavra-chave):
   - Checkbox "Travar tela até confirmação" em cada gatilho.
   - Quando ligada, o aviso aparece em tela cheia, escurecendo o restante do sistema, sem botão de fechar — apenas "Estou ciente" (e "Abrir conversa", que também confirma).

2. **Regra pronta já cadastrada**: gatilho "Menção @3136232190", ativo, com as variações do número (com e sem DDI/formatação), destino = setor Atendimento, som ligado e tela travada.

3. **Detecção da menção**: a mensagem recebida é verificada tanto no texto quanto na lista de menções do WhatsApp, para que a marcação com `@` seja reconhecida mesmo quando o app mostra o nome do contato no lugar do número.

4. **Comportamento do aviso**: continua com nome do gatilho, contato, trecho da mensagem, som e link para a conversa. A diferença é o bloqueio: enquanto houver aviso pendente, o operador não consegue usar o sistema.

## Detalhes técnicos

- Migração: coluna `block_screen boolean not null default false` em `message_trigger_rules`; `INSERT` da regra da menção (palavras: `@3136232190`, `3136232190`, `553136232190`, `+55 31 3623-2190`), `alert_target_type = 'sector'` apontando para o setor Atendimento, `action_type = 'floating_alert'`, `sound_enabled = true`, `cooldown_minutes` curto.
- `src/lib/message-triggers.server.ts`: incluir `block_screen` no tipo `Rule` e propagar em `action_taken` (`{ sound, block }`) ao inserir em `message_trigger_logs`.
- `src/routes/api.public.zapi-webhook.$channelId.tsx`: concatenar as menções do payload ao `text` enviado a `evaluateMessageTriggers` (campo de menções do Z-API, quando presente), sem alterar o texto persistido da mensagem.
- `src/components/message-trigger-alert.tsx`: quando o log pendente tiver `action_taken.block`, renderizar overlay fixo `inset-0` com backdrop, sem botão X e sem dispensar por `dismissedIds`; somente `acknowledge()` (grava `acknowledged_at`) libera. Alertas normais mantêm o comportamento atual.
- `src/components/configuracoes/message-triggers-config.tsx`: campo `block_screen` no tipo `Rule`, em `EMPTY`, no formulário e no badge de resumo da regra.
