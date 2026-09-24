# Teste de Equipamento: "Status da pendência" travado em "Resolvido"

## O que muda
Na janela **Finalizar atendimento** da Central:
- Quando o tipo de pendência escolhido for **Teste de Equipamento**, o campo "Status da pendência" passa automaticamente para **Resolvido** e fica bloqueado (o operador não consegue trocar).
- Aparece um aviso abaixo: "Teste de Equipamento: o atendimento será encaminhado ao setor Administrativo com status A resolver."
- Se o operador trocar o tipo de pendência para outro, o campo volta a ficar liberado.

## Fluxo após finalizar (mantido)
- O atendimento segue o fluxo já existente: vai para o setor **Administrativo** (setor configurado em Configurações → Teste de Equipamento) com status **A resolver / aberto**, sem responsável, com registro de encaminhamento no histórico.
- A pendência no GSystem não é concluída nesse caso (continua aberta junto com o atendimento), como já acontece hoje.

## Detalhes técnicos
- `src/routes/central.tsx`, diálogo de finalização (~linha 5356): calcular `isTEFinalize = isTesteEquipamentoCategory(label do tipo selecionado, teSettings)`; `useEffect` força `setFinalizeStatus("Resolvido")` quando verdadeiro; `Select` com `disabled={isTEFinalize}` e texto de aviso.
- Na função de finalizar, reforço: se for Teste de Equipamento, usa `status = "Resolvido"` independentemente do estado da tela; o ramo `isTEFlow` existente continua fazendo o encaminhamento ao setor destino com `target_status`.
