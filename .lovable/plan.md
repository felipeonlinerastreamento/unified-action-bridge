## Objetivo

Quando "Interagir com apelido" estiver ligado, enviar a mensagem prefixada com o nome do **responsável pelo atendimento** (operador atribuído ao chat) — e não com o nome do usuário logado.

## Causa atual

Em `src/routes/central.tsx` (linhas 2195–2207), o `handleSend` monta o prefixo do apelido a partir de `profile?.name` (usuário logado). Quem está digitando pode ser um co-atendente ou outro operador, então o nome enviado nem sempre é o do responsável.

## Correção

No `handleSend` (`src/routes/central.tsx` ~linha 2195), trocar a fonte do nome usado no prefixo:

- Usar `assignedOperator` (já existe — query em ~linha 731 que resolve o nome do `assigned_to` do chat) como nome principal.
- Fallback para `profile?.name` somente quando o chat não tiver responsável atribuído (caso de chat ainda não assumido), preservando o comportamento anterior nesse caso.
- Restante do fluxo (whisper, replyTo, envio) inalterado.

Resultado: o WhatsApp do contato recebe `*Nome do Responsável:* mensagem`, mesmo quando outro operador (co-atendente) digita.

## Validação

- Chat com responsável "Ricardo": qualquer operador que enviar com modo apelido → contato recebe `*Ricardo:* ...`.
- Chat sem responsável: mantém `*Nome do Operador Logado:* ...`.
- Modo whisper / nota privada: inalterado (não usa prefixo).
- Exibição local (já tratada anteriormente para não duplicar o nome): continua removendo o prefixo do balão.
