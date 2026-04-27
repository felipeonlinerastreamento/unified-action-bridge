## Objetivo

1. **Adicionar campo de placa** ao finalizar atendimento no chat (Central) e ao criar atendimento no menu Atendimentos — **opcional**.
2. **Adicionar filtro de placa** na tela de Relatórios.

---

## 1. Campo placa ao finalizar atendimento no chat

**Arquivo:** `src/routes/central.tsx` — diálogo "Finalizar atendimento" (linhas ~2900-3000)

- Adicionar campo **"Placa do veículo"** (opcional) abaixo de "Tipo de pendência".
- Pré-preencher com `currentTicket.plate || ticketPlate` (placa já detectada nas mensagens, se houver).
- No submit do diálogo, se a placa foi alterada, persistir via `updatePlateMutation` (já existe no arquivo, linha ~997) antes de finalizar.
- Normalizar para maiúsculas; aceitar formato antigo (`ABC-1234`) e Mercosul (`ABC1D23`); permitir vazio.

## 2. Campo placa ao criar atendimento no menu Atendimentos

**Arquivo:** `src/components/atendimentos/ticket-create-dialog.tsx`

- O campo já existe (linha 436). Apenas:
  - Normalizar para maiúsculas ao salvar.
  - Manter como **opcional** (sem validação obrigatória).
  - Garantir que está bem visível no formulário (já está).

> Observação: como o campo já existe e é opcional, na prática esta etapa é apenas um polimento de UX (uppercase automático). Se preferir, posso pular esta parte.

## 3. Filtro por placa em Relatórios

**Arquivos:**
- `src/components/relatorios/report-filters.tsx`
- `src/routes/relatorios.tsx`

Mudanças:
- Adicionar input de texto **"Placa"** no `ReportFilters` (busca parcial, case-insensitive, com botão "x" para limpar).
- Em `relatorios.tsx`:
  - Novo state `plateFilter`.
  - Aplicar filtro no array `tickets` antes de calcular KPIs e gráficos da aba **Atendimentos**.
  - Quando uma placa estiver preenchida, exibir uma **tabela "Histórico da placa"** abaixo dos KPIs com colunas: Data, Status, Setor, Categoria, Contato, Atendente, Tempo de resolução.
  - Filtro também é aplicado ao export atual (CSV/XLSX/PDF).

## Resumo das mudanças

| Arquivo | Mudança |
|---|---|
| `src/routes/central.tsx` | Novo campo Placa (opcional) no diálogo "Finalizar atendimento", salva via mutation existente |
| `src/components/atendimentos/ticket-create-dialog.tsx` | Normalização para uppercase (campo segue opcional) |
| `src/components/relatorios/report-filters.tsx` | Novo input "Placa" como filtro |
| `src/routes/relatorios.tsx` | State + filtro aplicado a tickets + tabela "Histórico da placa" + export filtrado |

## Não faz parte deste plano

- Mudanças no schema do banco (a coluna `service_tickets.plate` já existe).
- Validação obrigatória da placa em qualquer fluxo.
- Alteração da detecção automática de placas em mensagens (continua funcionando).

Pode prosseguir?