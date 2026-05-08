## Objetivo

Unificar "Itens de Compra (Suprimento)" e "Itens de Compra (Equipamento/Chip)" em um único módulo **Solicitação de Compra**, com fluxo configurável, cadastro de fornecedores, painel de acompanhamento e relatórios analíticos.

---

## 1. Configurações → Encaminhamento → "Solicitação de Compra"

Substitui as duas seções atuais (Suprimento + Equipamento/Chip) por uma única aba **Solicitação de Compra** com 3 sub-abas:

### 1a. Itens (catálogo unificado)
- Lista mesclada com todos os itens cadastrados nas duas tabelas antigas (preservados via migração).
- Campos: Nome, Quantidade padrão, Tipo opcional (Suprimento/Equipamento/Outro — só rótulo, não restringe), Ativo.
- CRUD igual ao atual.

### 1b. Fornecedores (novo)
Cadastro completo de fornecedores reutilizáveis:
- Nome / Razão social
- CNPJ (opcional)
- **Observações** (campo livre multilinha)
- **Contatos** (lista: nome, cargo, telefone, e-mail — múltiplos contatos por fornecedor)
- Ativo / Inativo

### 1c. Configuração do Fluxo
Toggles para definir quais campos aparecem no chamado e quais são obrigatórios:
- Item, Quantidade, Valor unitário, Valor total (auto), Frete
- Fornecedor (com botão "+ Novo fornecedor" inline)
- Código de rastreio
- Previsão de entrega
- Contato do vendedor (autopreenchido a partir do fornecedor)
- Limite de variação de preço aceitável (default: 10%) — usado nos alertas de relatório

---

## 2. Atendimentos — Categoria "Solicitação de Compra"

Quando ticket abre/é editado nessa categoria, o painel substitui os atuais `compra-equipamento-fields` e `suprimento-fields` por um único bloco:

- Tabela de itens (linhas): Item, Qtd, Valor Unit., Valor Total (calc.), Frete (rateado ou no rodapé).
- Ao selecionar um item: mostra **"Última compra: R$ X,XX em DD/MM/AAAA — Fornecedor Y"** abaixo do campo de valor.
- Campos do ticket (uma vez): Fornecedor (select com cadastro inline), Rastreio, Previsão de entrega, Contato vendedor.
- Status de compra: Solicitado → Cotação → Comprado → Em transporte → Entregue.

---

## 3. Painel de Acompanhamento

Ao filtrar categoria = "Solicitação de Compra" em Atendimentos:
- KPIs no topo: Total em aberto (R$), Comprado no mês, Entregues, Atrasados (previsão vencida).
- Visão tabela com colunas: Protocolo, Solicitante, Itens, Valor total, Fornecedor, Status, Previsão, Rastreio.
- Toggle para visão Kanban por status de compra.

---

## 4. Relatórios → "Compras"

Nova aba em `/relatorios`:

**Dashboard (topo) — 3 KPIs:**
1. Gasto total no período
2. Saving acumulado (vs. média histórica)
3. Itens com alerta de inflação (> limite configurado)

**Filtros:** período, item, fornecedor, solicitante.

**Seções:**
- **Variação de preço por item** — tabela com último preço, média, mín, máx, variação %; linhas em vermelho quando variação > limite, em verde quando saving.
- **Frequência de compra** — itens comprados ≥ N vezes em 30 dias (alerta de ineficiência sugerindo compra em volume).
- **Concentração de fornecedores** — % do volume financeiro por fornecedor (alerta quando único fornecedor > 70%).
- **Histórico por item** — gráfico de linha de preço unitário ao longo do tempo.

**Exportação:** CSV e XLSX (com formatação condicional nas células de variação).

---

## Detalhes Técnicos

### Migração de banco
- Cria `purchase_items` (catálogo unificado), `purchase_suppliers`, `purchase_supplier_contacts`, `ticket_purchase_requests` (cabeçalho do ticket: fornecedor_id, frete, rastreio, previsão, contato), `ticket_purchase_items` (linhas: item_id, qtd, valor_unit, status).
- Migra dados de `suprimento_items` + `compra_equipamento_items` → `purchase_items` (deduplicado por nome, mantém qtd padrão maior).
- Migra `ticket_suprimento_items` + `ticket_compra_equipamento_items` → `ticket_purchase_items`.
- Mantém tabelas antigas por 1 release como fallback (somente leitura).
- View `v_purchase_item_history` para consultas de "última compra" e relatórios de variação.
- Configuração do fluxo armazenada em `app_settings` (chave `purchase_flow_config` JSON).

### Frontend
- Novo hook `use-purchase-requests.tsx` substitui `use-suprimento` e `use-compra-equipamento`.
- Novos componentes: `purchase-request-fields.tsx`, `purchase-supplier-picker.tsx`, `ticket-purchase-section.tsx`, `purchase-tracking-panel.tsx`, `purchase-config.tsx`, `purchase-suppliers-config.tsx`, `purchase-flow-config.tsx`.
- Nova rota `/relatorios` aba "Compras" → `purchase-report-tab.tsx` usando Recharts.
- Mantém detecção da categoria via keywords (adiciona "solicitação de compra") em `chat-utils` / hooks.

### Compatibilidade
- Categoria "Solicitação de Suprimento" e "Solicitação Compra Equipamento/Chip" passam a redirecionar internamente para o novo fluxo (badges/sections antigos viram wrappers).