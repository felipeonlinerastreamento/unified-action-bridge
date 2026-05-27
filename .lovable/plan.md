## Objetivo
Corrigir apenas o botão **Finalizar** do menu **Atendimentos**, garantindo que ele altere o ticket para `finalizado` de verdade, sem mexer nas regras anteriores da Central, TE ou roteamento por categoria.

## Escopo da correção
1. **Manter intactas as regras da Central**
   - Não alterar finalização de chat.
   - Não alterar roteamento TE.
   - Não alterar regra de categoria.
   - Não alterar sincronização GSystem.

2. **Isolar a regra do menu Atendimentos**
   - No painel de detalhe e no Kanban, continuar usando a função direta `finalizeTicketStandalone`.
   - Ajustar essa função para ser mais robusta no contexto de Atendimentos: atualizar o ticket, confirmar o status gravado e só então exibir sucesso.

3. **Evitar mensagem falsa de sucesso**
   - Se o banco não retornar o ticket como `finalizado`, a tela deve mostrar erro em vez de “Ticket finalizado”.
   - Recarregar os dados do ticket após finalizar para refletir o status atualizado no painel e na lista.

4. **Preservar fechamento do chat vinculado**
   - Quando a finalização vier do menu Atendimentos, manter o comportamento atual: se houver chat vinculado, ele também é encerrado.

## Arquivos que pretendo alterar
- `src/lib/ticket-finalize-flow.ts`
  - Fortalecer `finalizeTicketStandalone` para validar a atualização e não depender de nenhum fluxo de roteamento.

- `src/components/atendimentos/ticket-detail-panel.tsx`
  - Garantir que o botão **Finalizar** use exclusivamente a finalização direta.
  - Invalidar/refazer a busca de `service-tickets` após sucesso.

- `src/components/atendimentos/ticket-kanban-view.tsx`
  - Aplicar a mesma regra direta ao arrastar para a coluna **Finalizado**.

## Validação
- Conferir que o chamado `#01716` já está `finalizado` no banco.
- Após a alteração, o fluxo do menu Atendimentos só mostrará sucesso se a atualização for confirmada.
- Nenhum código da Central/roteamento será alterado.