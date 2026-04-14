

## Problem Diagnosis

1. **Data IS loading** from GSystem API -- the response contains pendencias with statuses like "Resolvida", "Aberta", etc.
2. **Client-side filter mismatch**: The default filter is "aberto" and the code checks if `status.toLowerCase().includes("aberto")`. But the GSystem API uses "Aberta" (not "Aberto"), so open items may not match.
3. **Only 30-day window**: The query hardcodes a 30-day lookback, which may miss older open pendencias.
4. **Limited filters**: User wants more search/filter options beyond just text search and status.

## Plan

### 1. Fix status filter matching
- Update the status filter values to match actual GSystem statuses: "Aberta", "Resolvida", "Em Andamento", "Cancelada"
- Add "aberta" as a match term (the API uses "Aberta" not "Aberto")

### 2. Add date range filter
- Add date pickers for "Data Inicial" and "Data Final" so the user can control the query period
- Default to last 90 days instead of 30
- Pass user-selected dates to the `getPendencias` server function

### 3. Add more filter options
- **Tipo** (type) filter: e.g. "Agendamento", "Liberação de Equipamento", "Cadastrar/Atualizar acessos"
- **Cliente** filter: text input to filter by client name
- **Prioridade** filter: filter by priority level
- **Ramal** (operator) filter: filter by who handled the item

### 4. Improve the filter UI layout
- Create a collapsible filter panel with all filter options organized in a grid
- Show active filter count as a badge
- Add "Limpar filtros" (clear filters) button

### Files to modify
- `src/routes/atendimentos.tsx` -- Rework filters UI, fix status matching, add date pickers, add new filter fields
- `src/lib/gsystem-api.functions.ts` -- Update `getPendencias` input validator to accept wider date range params (already supports `clienteKey`/`veiculoKey`)

### Technical Details
- Use the existing Shadcn `Calendar`/`Popover` for date pickers with `date-fns` formatting
- Extract unique Tipo/Ramal values from the response data dynamically to populate filter dropdowns
- The `getPendencias` server function already supports `clienteKey` and `veiculoKey` params -- wire those up
- Keep the 30-second auto-refresh (`refetchInterval`) but use the user-selected date range

