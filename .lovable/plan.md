Adicionar coluna **Fornecedor** na tabela "Variação de preço por item" do relatório de compras (`src/components/relatorios/purchase-report-tab.tsx`).

Como cada item pode ter sido comprado de mais de um fornecedor no período, vou:

1. No agregador `byItem`, guardar também o conjunto de fornecedores (`suppliers: Set<string>`) e o **fornecedor da última compra** (`lastSupplier`).
2. Na tabela, adicionar uma coluna **Fornecedor** logo após "Última compra", mostrando:
   - O nome do fornecedor da última compra, e
   - Se houver mais de um fornecedor no período, um sufixo `+N` (ex.: `Acme +2`) para indicar variedade.
3. Adicionar o mesmo campo ao CSV exportado (`Fornecedor (última)` e `Fornecedores no período`).

Sem mexer em regras de negócio, filtros, KPIs ou nas outras tabelas do relatório.
