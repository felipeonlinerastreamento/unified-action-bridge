

## Plano: Vínculo Fluxo ↔ Categoria + Ativação Automática na Finalização

### Resumo
Adicionar coluna `trigger_categories` na tabela `service_flows` para vincular categorias do GSystem a fluxos. No dialog de criar/editar fluxo, exibir seletor multi-select com os tipos de pendência. Na finalização da Central, verificar se a categoria selecionada possui fluxo ativo e criar automaticamente uma instância do fluxo.

### 1. Migração SQL
- Adicionar coluna `trigger_categories text[] default '{}'` na tabela `service_flows`

### 2. FlowList — Seletor de categorias vinculadas
**Arquivo:** `src/components/fluxo-atendimento/flow-list.tsx`

- Importar `getTiposPendencia` do GSystem para buscar a lista de categorias
- No dialog de criar/editar fluxo, adicionar campo multi-select (checkboxes) com as categorias disponíveis
- State `triggerCategories: string[]` para armazenar os Keys selecionados
- Salvar no `insert`/`update` da mutation junto com os outros campos
- Na tabela de fluxos, exibir badges com as categorias vinculadas
- Atualizar o tipo `Flow` para incluir `trigger_categories: string[]`

### 3. Central — Ativação automática do fluxo na finalização
**Arquivo:** `src/routes/central.tsx`

- Na `finalizeMutation`, após finalizar o ticket, consultar `service_flows` filtrando onde `trigger_categories` contém o `tipoPendencia` selecionado e `is_active = true`
- Se encontrar um fluxo correspondente:
  - Buscar a primeira etapa (`service_flow_steps` com `step_order` mínimo)
  - Criar registro em `attendance_flow_instances` com `flow_id`, `attendance_id`, `current_step_id` e `status = 'em_andamento'`
  - Criar registro em `attendance_flow_history` para registrar o início
  - Exibir toast informando: "Fluxo '{nome}' ativado — encaminhado para {setor}"
- Se não encontrar fluxo, finalizar normalmente como já funciona

### 4. Fluxo visual

```text
Operador finaliza → Categoria: "Manutenção"
        │
        ▼
  service_flows WHERE 'Manutenção' = ANY(trigger_categories) AND is_active
        │
   ┌────┴────┐
   │ Encontrou│ → Cria flow_instance + history → Toast "Fluxo ativado"
   └────┬────┘
   │ Não encontrou │ → Finalização normal
```

### Arquivos modificados
- **Migração SQL** — `ALTER TABLE service_flows ADD COLUMN trigger_categories`
- `src/components/fluxo-atendimento/flow-list.tsx` — multi-select de categorias no dialog + badges na tabela
- `src/routes/central.tsx` — lógica de verificação e ativação de fluxo na finalização

### Detalhes técnicos
- A query do fluxo usará `.contains('trigger_categories', [tipoPendencia])` do Supabase JS
- O `getTiposPendencia` será chamado via `useQuery` no FlowList para popular o seletor
- O tipo `Flow` e o tipo do Supabase serão atualizados automaticamente após a migração

