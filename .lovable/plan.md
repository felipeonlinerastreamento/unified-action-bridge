# Fallback de modelos de equipamento

Quando um sub-item não tiver modelos vinculados, em vez de só mostrar o aviso, exibir o seletor com **todos os modelos ativos** do menu "Liberação de Equipamento" como fallback.

## Mudanças

1. **`src/hooks/use-liberacao-equipamento.tsx`**
   - Criar novo hook `useSubcategoryEquipmentModelsWithFallback(subcategoryId)`:
     - Carrega vínculos via `useSubcategoryEquipmentModels`.
     - Se a lista estiver vazia, retorna o catálogo ativo via `useLiberacaoCatalog` mapeado para o mesmo formato `{ equipment_item_id, name }`.
     - Expõe também flag `isFallback: boolean` para a UI saber que está mostrando o catálogo completo.

2. **`src/components/atendimentos/ticket-create-dialog.tsx`**
   - Substituir o uso de `useSubcategoryEquipmentModels` pelo novo hook.
   - Remover o bloco "Nenhum modelo vinculado…"; sempre mostrar o `Select`.
   - Quando `isFallback`, exibir um pequeno hint cinza abaixo: *"Mostrando todos os modelos cadastrados em Liberação de Equipamento."*

3. **`src/routes/central.tsx`** (popover Finalizar)
   - Mesma troca de hook + remover o aviso de "Sem modelos vinculados" e mostrar o select sempre.
   - Hint discreto quando fallback.

4. **`src/components/atendimentos/ticket-detail-panel.tsx`**
   - Mesma troca; select sempre renderizado; hint quando fallback.

## Fora de escopo
- Sem mudanças de schema/RLS.
- Sem mudanças na tela de Configurações › Sub-Menu de Categorias (o admin continua podendo vincular modelos específicos para restringir as opções).
- Comportamento de seleção/salvamento do `equipment_model_id` permanece igual.
