
# Itens Perdidos — Plano de implementação

Replica o padrão já consolidado de "Suprimento" / "Compra Equipamento", adicionando suporte a **valor unitário** por item (campo novo).

## 1. Banco de dados (migração)

Duas novas tabelas com RLS no padrão das demais (admin/gestor gerenciam, atendentes leem/inserem nos próprios tickets).

**`perdidos_items`** (catálogo configurável)
- `id uuid pk`, `name text not null`, `default_quantity int default 1`
- `default_unit_value numeric(10,2) default 0` (valor unitário sugerido, opcional)
- `is_active bool default true`, `created_at`, `updated_at`

**`ticket_perdidos_items`** (itens vinculados ao chamado)
- `id uuid pk`, `ticket_id uuid → service_tickets(id) on delete cascade`
- `item_id uuid → perdidos_items(id)`, `item_name text` (snapshot)
- `quantity int not null default 1`
- `unit_value numeric(10,2) not null default 0`
- `total_value numeric(12,2) generated always as (quantity * unit_value) stored`
- `created_at`, `created_by`

Índices: `ticket_id`, `item_id`. Triggers `update_updated_at_column` no catálogo.

RLS:
- `perdidos_items`: SELECT autenticados; INSERT/UPDATE/DELETE apenas admin/gestor (`has_role`).
- `ticket_perdidos_items`: SELECT/INSERT/DELETE para autenticados (mesmas regras já usadas em `ticket_suprimento_items`).

## 2. Configurações > Encaminhamento

Novo card `PerdidosConfig` em `src/components/configuracoes/perdidos-config.tsx` (clone de `suprimento-config.tsx` + campo extra "Valor unitário padrão" com `Input type=number step=0.01`). Renderizado em `src/routes/configuracoes.encaminhamento.tsx` logo após `<CompraEquipamentoConfig />`.

Operações: criar / editar / excluir / ativar item do catálogo.

## 3. Hook + componentes do chamado

**`src/hooks/use-perdidos.tsx`** — segue `use-suprimento.tsx`:
- `isPerdidosCategory(cat)` reconhece `"perdidos"`, `"perdido"`, `"itens perdidos"`.
- `usePerdidosCatalog()`, `useTicketPerdidosItems(ticketId)`.
- Tipos `PerdidosCatalogItem` (com `default_unit_value`) e `TicketPerdidosItem` (com `unit_value`, `total_value`).

**`src/components/atendimentos/perdidos-fields.tsx`** — clone de `suprimento-fields.tsx` adicionando coluna **Valor unitário** (numeric) ao lado de Qtd, e exibindo o **subtotal por linha** + **total geral** no rodapé do card. Exporta `validatePerdidosItems` (item, qtd > 0, valor ≥ 0).

**`src/components/atendimentos/ticket-perdidos-section.tsx`** — painel exibido no `ticket-detail-panel.tsx` quando categoria for "Perdidos". Lista itens já salvos, permite adicionar/remover (mesmas permissões dos demais).

## 4. Integração com criação de atendimento

Em `src/components/atendimentos/ticket-create-dialog.tsx`:
- Importar `isPerdidosCategory`, `PerdidosFields`, `validatePerdidosItems`.
- Estado `perdidosItems`.
- Renderizar `<PerdidosFields>` quando `isPerdidos`.
- Validar antes de submeter.
- Após criar o ticket, inserir as linhas em `ticket_perdidos_items`.

Em `ticket-detail-panel.tsx`: incluir `<TicketPerdidosSection ticketId={...} category={...} />` no mesmo bloco condicional dos demais módulos.

## 5. Relatório de Itens Perdidos

Novo componente `src/components/relatorios/perdidos-tab.tsx`:
- Query Supabase em `ticket_perdidos_items` filtrando por `created_at` no intervalo do filtro global (`dateFrom`/`dateTo`), com join no ticket para protocolo/empresa.
- KPIs (`ReportKpiCard`): Total de itens, Quantidade total, Valor total (R$).
- Tabela: Data | Protocolo | Empresa | Item | Qtd | Valor unitário | Valor total.
- Agrupamento por item (Bar/Pie chart usando Recharts já presente).
- Botões "Exportar CSV / PDF" usando `exportToCSV` / `exportToPDF` já existentes em `export-utils.ts`.

Em `src/routes/relatorios.tsx`:
- Adicionar `<TabsTrigger value="perdidos">Itens Perdidos</TabsTrigger>` na lista.
- Adicionar `<TabsContent value="perdidos"><PerdidosReportTab dateFrom={...} dateTo={...} /></TabsContent>`.

## 6. Detalhes técnicos

- Todos os acessos a tabelas novas via `supabase.from("perdidos_items" as any)` enquanto `types.ts` não regenera.
- Valores monetários armazenados como `numeric` e formatados em UI com `Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" })`.
- Sem alterações em edge functions; tudo client-side com RLS.

## Arquivos a criar/editar

Criar:
- migração SQL (tabelas + RLS + triggers)
- `src/components/configuracoes/perdidos-config.tsx`
- `src/hooks/use-perdidos.tsx`
- `src/components/atendimentos/perdidos-fields.tsx`
- `src/components/atendimentos/ticket-perdidos-section.tsx`
- `src/components/relatorios/perdidos-tab.tsx`

Editar:
- `src/routes/configuracoes.encaminhamento.tsx`
- `src/components/atendimentos/ticket-create-dialog.tsx`
- `src/components/atendimentos/ticket-detail-panel.tsx`
- `src/routes/relatorios.tsx`
