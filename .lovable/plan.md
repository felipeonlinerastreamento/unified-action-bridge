# Vínculo de Modelo de Equipamento ao Sub-Item

Permitir que cada sub-item de categoria (ex.: "Pane Rastreador → Buzzer disparado") tenha uma lista própria de modelos de equipamento (vindos do catálogo de Liberação de Equipamento). Ao criar um chamado em uma categoria que tenha sub-itens, o operador escolhe o problema (sub-item) **e** o modelo do equipamento (obrigatório).

## 1. Banco de dados (migration)

**Nova tabela `ticket_subcategory_equipment_models`** (N:N entre sub-item e itens do catálogo):
- `subcategory_id` → `ticket_subcategories.id` (cascade)
- `equipment_item_id` → `liberacao_equipamento_items.id` (cascade)
- `position` int (ordenação)
- PK composta (subcategory_id, equipment_item_id)
- GRANTs: select para `authenticated`; insert/update/delete só para admin via RLS
- RLS: leitura para authenticated; escrita só `has_role(auth.uid(), 'admin')`

**Novas colunas em `service_tickets`** (gravar o modelo escolhido no chamado):
- `equipment_model_id uuid` (FK soft → `liberacao_equipamento_items`, ON DELETE SET NULL)
- `equipment_model_name text` (snapshot para histórico, caso o item seja renomeado/excluído)

## 2. Tela de configuração (`ticket-subcategories-config.tsx`)

No dialog de criar/editar sub-item, abaixo de "Descrição":
- Novo bloco **"Modelos de equipamento vinculados"** — multi-select com checkboxes da lista `liberacao_equipamento_items` (ativos), ordenável por arrastar (opcional, ou simples ordem alfabética).
- Ao salvar o sub-item, sincroniza a tabela `ticket_subcategory_equipment_models` (delete + insert dos selecionados).
- Na tabela de listagem, mostrar badge com a contagem ("3 modelos vinculados").

## 3. Hook compartilhado

Novo `useSubcategoryEquipmentModels(subcategoryId)` em `src/hooks/use-liberacao-equipamento.tsx`:
- Retorna a lista de itens do catálogo vinculados ao sub-item, já com `id`/`name`.
- Cacheado por `queryKey: ["subcategory-equipment-models", subcategoryId]`.

## 4. Fluxo de criação do chamado

Locais a alterar (ambos já têm o select de sub-item):
- **`src/components/atendimentos/ticket-create-dialog.tsx`** (criação via Atendimentos)
- **`src/routes/central.tsx`** — fluxo de finalização no chat (já carrega `subcategoriesAll`)
- **`src/components/atendimentos/ticket-detail-panel.tsx`** — edição inline da categoria/sub-item (espelhar o mesmo campo)

Comportamento:
1. Quando o sub-item for selecionado, buscar `useSubcategoryEquipmentModels(subId)`.
2. Se a lista tiver itens → exibir um `Select` **"Modelo do equipamento *"** logo abaixo do sub-item.
3. Se a lista estiver vazia → não exibir o campo (sub-item não exige modelo).
4. Validação no submit: se o sub-item tem modelos vinculados e nenhum foi escolhido → `toast.error("Selecione o modelo do equipamento")` e bloqueia.
5. Ao criar/atualizar, gravar `equipment_model_id` + `equipment_model_name` (snapshot do nome no momento).

## 5. Exibição no painel do chamado

Em `ticket-detail-panel.tsx`, exibir uma linha "Modelo do equipamento: {name}" próximo ao sub-item, permitindo edição inline (mesmo `Select`) — invalida o sub-item ao trocar (se o modelo atual não estiver mais vinculado ao novo sub-item, limpa).

## 6. Detalhes técnicos

- Reaproveitar `useLiberacaoCatalog()` para a lista completa de modelos no admin.
- Sem alteração no PDF de tratativa (fora de escopo); o campo fica disponível para futuros relatórios via `equipment_model_name`.
- Sem impacto em chamados antigos: colunas nuláveis, validação só dispara quando há vínculos cadastrados para o sub-item.

## Arquivos afetados
- `supabase/migrations/...` (nova migration: tabela + colunas + RLS + GRANTs)
- `src/hooks/use-liberacao-equipamento.tsx` (novo hook)
- `src/components/configuracoes/ticket-subcategories-config.tsx` (UI de vínculo)
- `src/components/atendimentos/ticket-create-dialog.tsx` (campo + validação)
- `src/routes/central.tsx` (campo + validação na finalização do chat)
- `src/components/atendimentos/ticket-detail-panel.tsx` (campo + edição inline + exibição)
