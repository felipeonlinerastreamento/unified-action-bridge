## Objetivo
Permitir, dentro de uma proposta (oportunidade) do CRM, gerar novos orçamentos e manter um histórico de cada orçamento gerado com o nome do operador e a data de lançamento.

## Comportamento

Dentro do diálogo de edição de uma oportunidade do CRM:

1. Novo botão **"Gerar novo orçamento"** ao lado de "Itens da proposta".
2. Ao clicar, o sistema captura um snapshot dos itens atuais (categoria, quantidade, ativação, mensalidade) + totais e registra como um orçamento no histórico, junto com:
   - operador (usuário logado)
   - data/hora do lançamento
3. Logo abaixo aparece a seção **"Histórico de orçamentos"**, listando cada orçamento gerado em ordem decrescente, mostrando:
   - Nº do orçamento (sequencial dentro da proposta)
   - Operador
   - Data/hora
   - Totais (ativação, mensalidade, qtd. de itens)
   - Botão para expandir e ver os itens daquele orçamento (somente leitura)
4. O histórico fica visível apenas dentro do diálogo da proposta (não na ficha do contato).

Nada é copiado automaticamente entre orçamentos — cada clique apenas armazena o snapshot atual.

## Backend (migração)

Nova tabela `public.crm_opportunity_quotes`:

- `opportunity_id` (FK → `crm_opportunities`, on delete cascade)
- `quote_number` (int, sequencial por oportunidade)
- `items` (jsonb — mesmo formato de `contract_items`)
- `total_activation` (numeric)
- `total_monthly` (numeric)
- `notes` (text, opcional)
- `created_by` (uuid → auth.users)
- `created_at`, `updated_at`

GRANTs para `authenticated` e `service_role`. RLS habilitado com políticas:
- SELECT/INSERT para qualquer usuário autenticado (mesmo padrão de `crm_opportunities`).
- UPDATE/DELETE somente admin/gestor.

Trigger `BEFORE INSERT` que calcula `quote_number` como `MAX(quote_number)+1` por `opportunity_id`.

## Frontend

- `src/lib/crm.functions.ts`: adicionar server functions `createOpportunityQuote` e `listOpportunityQuotes` usando `requireSupabaseAuth`.
- `src/components/crm/crm-pipeline-tab.tsx`:
  - No diálogo, adicionar botão "Gerar novo orçamento" que chama `createOpportunityQuote` com os itens do form atual.
  - Renderizar lista de orçamentos via `useQuery(["crm-opportunity-quotes", editingId])`, com nome do operador (join com `profiles.name`) e data formatada em pt-BR.
  - Invalidar a query após cada novo orçamento.
  - Botão só fica ativo quando há `editingId` (proposta já salva) e itens > 0.

## Fora de escopo
- Não há cópia automática de itens entre orçamentos.
- Não aparece na ficha do cliente/contato.
- Não há edição de orçamento já lançado (apenas leitura no histórico).