## Plano

1. **Ajustar a criação/atualização do chamado na Central**
   - Quando o operador finalizar um chat com categoria **Teste de Equipamento**, tratar o fluxo como especial tanto em **Finalizado/Resolvido** quanto em **A resolver**.
   - O chamado deve ficar no setor configurado em **Configurações > Encaminhamento > Fluxo Teste de Equipamento** — hoje esperado como **Administrativo**.
   - O chamado deve ficar aberto para atendimento, sem `closed_at` e sem `closed_by`.

2. **Padronizar o status como “A resolver” no menu de Atendimentos**
   - Como a base atualmente usa status técnicos (`aberto`, `em_andamento`, `finalizado`, `reaberto`), vou manter o valor persistido como status aberto compatível com o menu de Atendimentos e garantir que ele apareça como chamado pendente/a resolver no setor Administrativo.
   - Evitar que o fluxo posterior sobrescreva esse chamado para `finalizado`.

3. **Corrigir o pós-fluxo que hoje falha em alguns cenários**
   - O `onSuccess` da finalização já tenta chamar `finalizeTicketWithFlow`, mas quando o status é **A resolver** ou quando a categoria não fica gravada a tempo, o roteamento pode não aplicar.
   - Vou garantir que a categoria resolvida seja preservada no ticket e que o fluxo Teste de Equipamento rode mesmo nesses casos.

4. **Evitar duplicidade e efeitos colaterais**
   - Não criar chamado duplicado se já existir chamado do chat.
   - Não concluir pendência no GSystem para Teste de Equipamento.
   - Não aplicar regra genérica de encaminhamento por categoria por cima do fluxo especial.

5. **Validação final**
   - Revisar os pontos de finalização do chat para confirmar que a regra vale para os dois caminhos: **Finalizado/Resolvido** e **A resolver**.
   - Conferir que o ticket resultante permanece no setor Administrativo com status aberto/a resolver no menu de Atendimentos.