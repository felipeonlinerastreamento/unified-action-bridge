## Diagnóstico do #01709

Conferi no banco: o chamado **#01709** ("Solicitação compra") tem **1 linha de item de compra** — `Cartão de memoria 128GB`, com **quantidade 20** e preço unitário R$ 254,14. Ou seja, o relatório está correto numericamente, mas a coluna **"Compras"** mostra `1` (= número de pedidos do item no período) e a coluna de **quantidade total (20)** simplesmente **não está sendo renderizada na tabela** — ela só existe hoje no CSV exportado.

Então a confusão é visual: o usuário vê "1" e imagina que o sistema perdeu 19 itens, quando na verdade são 20 unidades em 1 compra.

## O que vou ajustar (somente UI do relatório de compras)

Arquivo: `src/components/relatorios/purchase-report-tab.tsx`

Tabela **"Variação de preço por item"**:

1. Renomear a coluna `Compras` para `Nº compras` (deixa claro que é nº de pedidos, não unidades).
2. Adicionar coluna `Qtd. total` exibindo `e.qty` (soma das unidades). Para o #01709 isso passará a mostrar **20**.
3. Adicionar coluna `Última compra` exibindo `e.lastDate` formatado em `dd/MM/yyyy` (pt-BR).

Exportação CSV:

4. Já inclui "Qtd. total" e renomear "Compras no período" → "Nº compras".
5. Adicionar campo `Última compra` com a data formatada.

Não mexo em nenhuma regra de negócio, agregação, filtro, KPIs, nem nas outras tabelas (Frequência, Concentração de fornecedores). Mudança é puramente de apresentação na tabela principal e no CSV.

## Fora do escopo

- Não vou alterar `v_purchase_item_history`, hooks ou a tela de Solicitação de Compra.
- Não vou tocar no fluxo de finalização de chamados que ajustamos antes.
