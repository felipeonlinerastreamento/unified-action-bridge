

## Plan: Consulta de Estoque via API do GSystem

### Contexto
A API do GSystem (`api.gsystem.chat/core/v2/api`) que ja esta integrada no projeto possui endpoints conhecidos para chats, contatos, setores e usuarios. O usuario confirma que existe tambem uma API de estoque/inventario no GSystem.

### Abordagem
Como nao ha documentacao publica dos endpoints de estoque do GSystem, o plano sera:

1. **Descobrir endpoints de estoque no GSystem** -- Testar endpoints comuns como `/inventory`, `/equipment`, `/stock`, `/items` usando o token do canal ja configurado para identificar qual endpoint retorna dados de equipamentos.

2. **Criar server function de consulta** (`src/lib/gsystem.functions.ts`) -- Adicionar uma funcao `listInventory` que consulta o endpoint de estoque do GSystem, recebendo filtros opcionais de modelo e status.

3. **Refazer a pagina de Estoque** (`src/routes/estoque.tsx`) -- Remover toda logica de cadastro (AddItemDialog, botao "Novo Item"), remover dependencia do banco local (Supabase), e transformar a pagina em uma consulta read-only ao GSystem com:
   - Filtro por modelo (dropdown dinamico baseado nos dados retornados)
   - Filtro por status (disponivel/vinculado)
   - Campo de busca por texto livre
   - Tabela com resultados: Equipamento, Modelo, Status
   - Cards resumo: total, disponiveis, vinculados

### Detalhe tecnico
- A consulta ao GSystem sera feita via server function (proxy seguro, token nao exposto ao frontend)
- A pagina usara `useState` + `useEffect` para chamar a server function com os filtros
- Se o endpoint de estoque do GSystem nao existir ou retornar erro, sera exibida mensagem informativa ao usuario

### Arquivos modificados
- `src/lib/gsystem.functions.ts` -- nova server function `listInventory`
- `src/routes/estoque.tsx` -- reescrita para consulta read-only via GSystem

