## Diagnóstico

A funcionalidade já existe no código em três pontos (`TicketCreateDialog`, header de Finalização da Central, edição em `TicketDetailPanel`), mas o banco mostra **0 vínculos** entre sub-itens e modelos de equipamento:

```
Pane Rastreador > Buzzer Disparado → 0 modelos
Pane Rastreador > Erro GPS        → 0 modelos
```

Catálogo de modelos (ex.: "Telemetria JR12") está populado e ativo. Ou seja: o operador não vê o seletor porque nenhum modelo foi efetivamente vinculado ao sub-item no admin — o `Select` só renderiza quando `equipmentModels.length > 0`.

Além disso a descoberta da funcionalidade é fraca: ao abrir o diálogo "Novo sub-item" o bloco "Modelos de equipamento vinculados" é discreto e não há feedback claro de "X modelos vinculados" na lista, então o usuário não percebe que precisa marcar e salvar.

## O que entregar

1. **Admin de Sub-Menu de Categorias** (`ticket-subcategories-config.tsx`)
   - Destacar visualmente o bloco de modelos no diálogo de criação/edição (já existe, mas reforçar com banner curto: "Marque aqui os modelos que aparecerão para o operador ao escolher este sub-item").
   - Garantir que `syncSubcategoryEquipmentModels` está sendo chamado em criação e edição (já está, validar manualmente após a alteração).
   - Mostrar atalho rápido "Vincular modelos" direto na linha da tabela do sub-item quando `modelCounts[id] === 0`, abrindo o mesmo diálogo já em modo edição rolado até o bloco de modelos.

2. **Diálogo de criação de chamado** (`ticket-create-dialog.tsx`, linhas 839-853)
   - Manter o `Select` obrigatório quando há modelos vinculados (já está).
   - Quando o sub-item escolhido **não tem nenhum modelo vinculado**, exibir um hint discreto ("Nenhum modelo vinculado a este sub-item — configure em Configurações › Sub-Menu de Categorias") para que o operador entenda o porquê do campo não aparecer.

3. **Central — popover de Finalização** (`central.tsx`, linhas 3105-3127)
   - Aplicar o mesmo hint quando `finalizeSubcategoryId` está selecionado mas `finalizeEquipmentModels` está vazio.
   - Manter validação atual (linha 2927) que bloqueia finalizar sem modelo quando houver modelos vinculados.

4. **Painel de detalhe do chamado** (`ticket-detail-panel.tsx`, linhas 1191-1205)
   - Mesmo hint de ausência de vínculos.
   - Garantir que ao trocar o sub-item o `equipmentModelDraft` resete corretamente (já está implementado).

## Notas técnicas

- Não há mudança de schema. Tabela `ticket_subcategory_equipment_models` e hook `useSubcategoryEquipmentModels` já cobrem a leitura.
- O Select já é renderizado condicionalmente — basta adicionar o hint para o caso vazio e melhorar a descoberta no admin.
- Após o deploy, o usuário precisa abrir Configurações › Sub-Menu de Categorias → "Buzzer Disparado" → marcar "Telemetria JR12" → Salvar. A partir daí o seletor "Modelo do equipamento *" aparecerá automaticamente em criação/finalização.

## Fora do escopo

- Não alterar RLS nem schema.
- Não tocar na lógica de bot/zapi.
- Não migrar nada para edge functions.
