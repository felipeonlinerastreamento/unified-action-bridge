

## Plano: Filtros Acessíveis no Menu de Atendimentos

### Problema Atual
Os filtros de Status, Tipo, Cliente e Ramal estão escondidos dentro de um painel colapsável ("Collapsible"), exigindo um clique extra para acessá-los. O usuário precisa de filtros rápidos e visíveis — especialmente para filtrar por **atendimentos em aberto**, **por setor** e **por operador**.

### Solução
Substituir o layout colapsável por filtros sempre visíveis em uma barra horizontal com chips/botões rápidos para os filtros mais usados, mantendo os filtros avançados acessíveis.

### Mudanças

**1. Redesenhar `atendimentos-filters.tsx`**
- Remover o `Collapsible` — todos os filtros ficam visíveis por padrão
- Adicionar uma linha de **chips rápidos de status** (Todos, Em Aberto, Em Andamento, Resolvido, Cancelado) como botões toggle clicáveis acima dos selects
- Extrair o campo "Setor" dos dados GSystem (campo `Setor` ou `setor` das pendências) e adicioná-lo como novo filtro `Select`
- Reorganizar layout: linha 1 = busca + datas; linha 2 = chips de status; linha 3 = selects (Setor, Operador, Tipo, Cliente)
- Adicionar `setor` ao interface `Filters`

**2. Atualizar `atendimentos-content.tsx`**
- Extrair `availableSetores` dos dados (campo `Setor`/`setor` das pendências GSystem e setor dos tickets locais se disponível)
- Adicionar campo `setor` no item normalizado
- Aplicar filtro de setor na lógica de `filteredItems`
- Passar `availableSetores` para o componente de filtros

### Detalhes Técnicos

Interface `Filters` atualizada:
```typescript
export interface Filters {
  search: string;
  status: string;
  tipo: string;
  cliente: string;
  ramal: string;
  setor: string;      // novo
  dataInicial: Date;
  dataFinal: Date;
}
```

Layout dos filtros (sempre visíveis):
```
[Busca_______________] [Data Inicial] [Data Final]
[Todos] [Em Aberto] [Em Andamento] [Resolvido] [Cancelado]  ← chips toggle
[Setor ▼] [Operador ▼] [Tipo ▼] [Cliente______]  [Limpar]
```

### Arquivos Modificados
- `src/components/atendimentos/atendimentos-filters.tsx` — redesenho completo
- `src/components/atendimentos/atendimentos-content.tsx` — adicionar setor nos dados e filtros

