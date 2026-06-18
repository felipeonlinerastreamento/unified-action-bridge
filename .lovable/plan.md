## Problema

Em `src/components/atendimentos/ticket-filters.tsx`, a função `applyTicketFilters` faz um early-return quando há texto na busca, ignorando todos os outros filtros (status, data, setor, etc.).

```ts
if (filters.search && filters.search.trim()) {
  // ... retorna só pelo match de texto, ignorando o resto
}
```

## Mudança

Remover o early-return e tratar `search` como mais um critério dentro do `tickets.filter(...)` principal, junto com status, data, setor, prioridade, etc.

- Se `filters.search` estiver vazio → comportamento atual dos demais filtros.
- Se tiver texto → o ticket precisa casar com o texto da busca **E** também passar por todos os outros filtros ativos (status, prioridade, categoria, setor, responsável, telefone, data, tracking, recorrente).

A lógica de matching textual continua igual (compara contra `contact_name`, `notes`, `plate`, `contact_phone`, `attendance_id`, `category`, `sector`, `companies.name`, `protocol` e protocolos formatados).

## Arquivo afetado

- `src/components/atendimentos/ticket-filters.tsx` — apenas a função `applyTicketFilters`.

Nenhuma alteração de UI ou de outros componentes.