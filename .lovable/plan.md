## Problema

Hoje existe um único caminho de "finalização" (`finalizeTicketWithFlow`) que é chamado tanto pelo botão **Finalizar** do chat na Central (dentro do `onSuccess` da mutation em `src/routes/central.tsx`) quanto pelos botões **Finalizar** do ticket em Atendimentos (`ticket-detail-panel.tsx`, `ticket-kanban-view.tsx`).

Como essa função aplica roteamento de TE / regra de categoria, ela:

- No chat → encaminha o ticket para outro setor (correto, é o que queremos).
- No ticket → também tenta encaminhar; quando o ticket já está no destino, retorna `{ routed: true }` sem alterar nada, exibe "Atendimento finalizado" mas deixa o status como estava (caso #01716).

Toda vez que ajustamos uma das pontas, quebramos a outra.

## Solução

Separar em **duas regras independentes**, cada uma com seu próprio módulo e contrato claro.

### Regra A — Finalização do CHAT (Central de Atendimento)

Acionada pelo botão "Finalizar" dentro de um chat da Central.

Comportamento:
1. Cria/atualiza o ticket (protocolo) conforme a categoria escolhida no diálogo.
2. Aplica roteamento de TE / regra de categoria — o ticket pode permanecer **aberto em outro setor** (esse é o ponto do roteamento).
3. Cria/conclui pendência GSystem conforme regras existentes.
4. Envia mensagem de encerramento / CSAT.
5. **Sempre encerra o chat** (`zapi_chats.status = 'finalizado'` ou `aguardando_retorno` para "A resolver").
6. **NÃO** chama `finalizeTicketWithFlow` depois — a Regra A já decide o destino final do ticket.

### Regra B — Finalização do TICKET (Atendimentos)

Acionada pelos botões "Finalizar" no `ticket-detail-panel.tsx` e no kanban.

Comportamento:
1. **Sempre finaliza o ticket de verdade**: `status='finalizado'`, `closed_at=now()`, `closed_by=user.id`.
2. **Ignora roteamento** de TE / regra de categoria — quando o operador clica Finalizar no ticket, é finalização de verdade.
3. Registra comentário "Status alterado para finalizado".
4. **Fecha o `zapi_chats` vinculado** (se houver), como hoje, para o chat sair da Central.

## Mudanças por arquivo

### 1. `src/lib/ticket-finalize-flow.ts`

- Renomear o módulo conceitualmente em duas funções, mantendo o arquivo:
  - **`finalizeTicketStandalone({ ticket, userId })`** — nova função pública. É o passo 4 (Standard finalize) + `closeLinkedZapiChat` + comentário. Sem TE, sem regra de categoria, sem GSystem sync, sem `bypassRouting`.
  - **`routeTicketForChatFinalize({ ticket, userId, teSettings })`** — extrai apenas a lógica de roteamento (TE + category_routing_rules), sem a queda final em "status=finalizado". Retorna `{ routed, routedTo, syncedToGsystem, ... }`. Usada apenas pela Regra A (Central).
- Manter `finalizeTicketWithFlow` como wrapper deprecado por enquanto, encaminhando para a nova função correta de acordo com um parâmetro `mode: 'chat' | 'ticket'`, para não quebrar import paths em uma única migração. Remover assim que os call sites estiverem migrados.

### 2. `src/routes/central.tsx` (Regra A)

- `mutationFn`: manter a lógica atual de criar/atualizar o ticket com a categoria, rotear TE inline e atualizar `service_tickets`. Já é onde a Regra A vive.
- `onSuccess`: **remover** a chamada a `finalizeTicketWithFlow`. Em vez disso, se ainda for necessário garantir o roteamento (caso o ticket tenha sido criado depois), chamar `routeTicketForChatFinalize`. Isso elimina o conflito atual onde o `onSuccess` reaplica o fluxo e gera o no-op em tickets já roteados.
- Manter `liberacaoItems`, escalonamento Gestão e demais side-effects.

### 3. `src/components/atendimentos/ticket-detail-panel.tsx` (Regra B)

- Substituir as duas chamadas a `finalizeTicketWithFlow(...)` (linhas 593 e 639) por `finalizeTicketStandalone({ ticket, userId })`.
- Remover lógica que dependia de `routed/routedTo` na UI de feedback (mostrar apenas "Atendimento finalizado").

### 4. `src/components/atendimentos/ticket-kanban-view.tsx` (Regra B)

- Substituir `finalizeTicketWithFlow` (linha 63) por `finalizeTicketStandalone`.

### 5. Caso #01716 e similares

Com a Regra B aplicando finalize direto, qualquer ticket já roteado (em Administrativo, TE, etc.) que receber clique "Finalizar" no painel/kanban vai de fato para `status='finalizado'` com `closed_at=now()`, resolvendo o bug.

## Fora do escopo

- Mudanças de schema ou RLS.
- Mudança no comportamento de CSAT, escalonamento Gestão, criação de pendência GSystem ou liberação de equipamento.
- Mudança visual nos botões/diálogos.
- Edge function changes.

## Critério de aceite

- Finalizar pelo chat na Central com categoria TE → chat sai da Central, ticket fica **aberto** em Administrativo (mantém comportamento atual).
- Finalizar pelo painel do ticket (mesmo ticket TE em Administrativo, como #01716) → ticket vai para **finalizado**, `closed_at` setado, chat vinculado é encerrado.
- Finalizar pelo kanban → mesmo resultado da Regra B.
- Nenhuma reaplicação de roteamento depois do clique "Finalizar" no ticket.
