# Registro de Erros com Valor + Relatório Financeiro de Erros

Quando um atendimento for categorizado como **Erro** (categoria vinda do GSystem), o sistema abre um bloco para registrar o valor do prejuízo e o operador responsável. Esses lançamentos alimentam um novo relatório com filtros de período e estatísticas.

## 1. Campo de Erro no atendimento

Ao selecionar uma categoria do GSystem cujo nome contenha "erro", aparece o bloco **Erro / Prejuízo** — tanto na criação do atendimento quanto no painel de detalhes:

- Operador responsável (lista de usuários do sistema)
- Valor do erro (R$)
- Descrição do erro (texto curto, opcional)
- Possibilidade de adicionar mais de um lançamento por atendimento (vários operadores/valores)
- Total somado exibido no bloco

No painel de detalhes o bloco permite adicionar, editar e remover lançamentos, seguindo o mesmo padrão visual já usado em "Itens Perdidos".

## 2. Relatório "Erros & Valores"

Nova aba no menu **Relatórios**, visível apenas para Admin e Gestor.

Filtros: período (data de/até, atalhos 7/30/90 dias), operador responsável e busca por protocolo/cliente.

KPIs:
- Total de erros no período
- Valor total (R$)
- Valor médio por erro
- Operador com maior valor acumulado

Gráficos:
- Barras: valor total por operador
- Barras: quantidade de erros por operador
- Linha: evolução de valor por dia/semana no período

Tabela detalhada: data, protocolo, cliente/contato, categoria, operador responsável, descrição, valor. Exportação em CSV e PDF, igual às demais abas.

## Detalhes técnicos

- Nova tabela `ticket_error_entries`: `ticket_id`, `operator_user_id`, `operator_name` (snapshot), `description`, `amount` (numeric 12,2), `created_by`, `created_at`, `updated_at`. RLS: leitura/escrita para usuários autenticados na inserção pelo próprio atendimento; leitura ampla para autenticados (o gate de gestão é feito na tela do relatório, como nas demais abas). Grants para `authenticated` e `service_role`.
- Novo hook `src/hooks/use-ticket-errors.tsx` com `isErrorCategory(category)` (match por palavra-chave "erro" na descrição da categoria GSystem), consultas do catálogo de operadores (`profiles`) e dos lançamentos do ticket.
- Novo componente `src/components/atendimentos/error-fields.tsx` (linhas no formulário de criação, espelhando `perdidos-fields.tsx`) e `src/components/atendimentos/ticket-error-section.tsx` (CRUD no painel de detalhes).
- Integração em `ticket-create-dialog.tsx` (persistir linhas após criar o ticket) e `ticket-detail-panel.tsx` (exibir a seção quando a categoria for de erro).
- Novo `src/components/relatorios/errors-report-tab.tsx` reutilizando `ReportKpiCard`, `report-filters` e `export-utils`; aba registrada em `src/routes/relatorios.tsx` com renderização condicionada ao papel admin/gestor (via `use-user-permissions`).
