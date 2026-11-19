# Corrigir erro "record new has no field is_recurring" ao finalizar chamados

## Problema
Toda finalização de chamado falha porque a regra do banco que exige o termo técnico lê um campo de recorrência que não existe na tabela de chamados.

## Correção
- Nova alteração no banco que recria a função de validação do termo técnico (`enforce_technical_term_before_finalize`), trocando a leitura de `NEW.is_recurring` por uma consulta em `ticket_reminders` (lembrete ativo com recorrência diferente de "none").
- O restante da regra continua igual: exigir termo enviado para categorias que pedem termo, e aceitar contingência com justificativa.
- Conferir no código se algum outro ponto usa `is_recurring` em `service_tickets` e ajustar.

## Verificação
- Conferir a definição da função no banco depois da alteração.
- Testar uma atualização de status para finalizado em um chamado comum (dentro de transação revertida) para confirmar que não dá mais erro.
