## Diagnóstico

Encontrei dois problemas relacionados, com a mesma raiz: o diálogo de criação de ticket (`src/components/atendimentos/ticket-create-dialog.tsx`) não está gravando nem **quem criou** o ticket, nem **quem é o responsável** por ele.

### Bug 1 — "Criado por:" vazio
No insert em `service_tickets` (linhas 345-360 de `ticket-create-dialog.tsx`) não é passado o campo `opened_by`. Como o painel de detalhe lê `ticket.opened_by` para mostrar o nome, ele sempre cai no `"—"`.

### Bug 2 — Vários atendimentos sem nome do responsável no balão
O badge "Operador responsável" em `ticket-list-view.tsx` (linha 67) só aparece quando `t.assigned_to` está preenchido. O insert de criação também **não preenche** `assigned_to`, então todo ticket criado manualmente nasce sem responsável e sem badge. Só os tickets gerados por chats (que têm operador atribuído automaticamente) mostram o nome.

## Plano

### 1. Gravar criador e responsável ao criar ticket
Em `src/components/atendimentos/ticket-create-dialog.tsx`, dentro do `insert` em `service_tickets`:

- Obter `authUser` (`supabase.auth.getUser()`) **antes** do insert (hoje só é obtido bem depois, na linha 450).
- Adicionar dois campos ao payload:
  - `opened_by: authUser?.id ?? null` — quem criou (resolve Bug 1).
  - `assigned_to: authUser?.id ?? null` — assume como responsável quem está criando (resolve Bug 2 para novos tickets).

### 2. Fallback de exibição no badge para tickets antigos
Para os tickets já existentes que ficaram sem `assigned_to`, ajustar `src/components/atendimentos/ticket-list-view.tsx` para que o badge "Operador responsável" também apareça usando, em ordem de prioridade:

1. `t.assigned_to` (atual)
2. `t.opened_by` (quem abriu) — rótulo: "Aberto por"
3. `t.agent_user_ids[0]` (primeiro agente vinculado em `ticket_agents`)

Quando vier do fallback, o `title` do badge muda para deixar claro ("Aberto por" / "Agente vinculado") em vez de "Operador responsável".

### 3. Sem alterações de banco / RLS
Os campos `opened_by` e `assigned_to` já existem em `service_tickets` e são usados em outros pontos do código. Nenhuma migration é necessária.

## Arquivos alterados
- `src/components/atendimentos/ticket-create-dialog.tsx` — adicionar `opened_by` e `assigned_to` no insert.
- `src/components/atendimentos/ticket-list-view.tsx` — fallback de exibição no badge.

## Fora do escopo
- Backfill em massa dos tickets antigos para preencher `assigned_to`/`opened_by` retroativamente. Se você quiser, faço numa segunda rodada com uma migration de update direcionada (ex.: copiar `opened_by` para `assigned_to` onde estiver nulo).
