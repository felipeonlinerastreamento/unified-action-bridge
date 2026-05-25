## Objetivo
Corrigir o fluxo de finalização para que chamados marcados como **Teste de Equipamento** cheguem ao roteamento correto daqui pra frente, em vez de serem persistidos com outra categoria e escaparem da regra.

## O que encontrei
- O ticket **#01644** está salvo em `service_tickets` com:
  - categoria: **Assuntos Comerciais**
  - setor: **Comercial**
  - status: **aberto**
- A configuração de **Teste de Equipamento** está ativa e aponta para:
  - setor destino: **Administrativo**
  - status destino: **aberto**
  - sync GSystem: **desligado**
- A função `finalizeTicketWithFlow` já tem o bloco de Teste de Equipamento, então ela só dispara se a categoria do ticket for reconhecida como TE.
- Na Central, a categoria usada no finalize vem de `resolvedCategoryLabel`, e o #01644 foi persistido como **Assuntos Comerciais** antes do roteamento rodar.

## Plano
1. **Auditar o caminho da categoria no finalize da Central**
   - Revisar o fluxo entre seleção de `tipoPendencia`, abertura do modal de Teste de Equipamento, confirmação e persistência do ticket.
   - Identificar em que ponto a categoria selecionada está sendo trocada, mantida stale, ou reaproveitada de um estado anterior.

2. **Corrigir a persistência da categoria final**
   - Garantir que, ao finalizar com categoria de Teste de Equipamento, o ticket seja salvo com a categoria correta antes de chamar `finalizeTicketWithFlow`.
   - Evitar sobrescrever a categoria com um valor anterior como “Assuntos Comerciais”.
   - Preservar o comportamento atual dos outros fluxos (Assuntos Comerciais, Liberação, Não categorizar etc.).

3. **Validar o roteamento após a correção**
   - Confirmar que um finalize com categoria Teste de Equipamento:
     - salva a categoria correta no ticket
     - reabre/encaminha para **Administrativo**
     - mantém o status do ticket em **aberto**
     - não liga sync GSystem
   - Verificar que categorias não-TE continuam seguindo as regras atuais.

## Detalhes técnicos
- Arquivos mais prováveis:
  - `src/routes/central.tsx`
  - `src/lib/ticket-finalize-flow.ts`
- Foco da correção:
  - origem de `resolvedCategoryLabel`
  - transição `showTeDialog -> showFinalizeConfirm -> finalizeMutation`
  - update/insert de `service_tickets.category`
- Sem backfill dos chamados antigos, conforme combinado.

## Resultado esperado
Ao finalizar um atendimento como **Teste de Equipamento**, o sistema deve persistir essa categoria corretamente e então aplicar o encaminhamento automático para o setor configurado.