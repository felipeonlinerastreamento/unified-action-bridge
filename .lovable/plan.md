# Plano CRM Estratégico — Versão Consolidada

Incorpora a proposta original (organização, aniversários, pós-venda, recorrências) **+ Fase 4 (Inteligência e Vendas)**, com **Pipeline de Vendas e Alertas de Renovação antecipados para a Fase 2**.

## Estrutura final do menu CRM

```text
/crm
 ├─ Visão Geral         → KPIs, agenda do dia, alertas de churn e renovação
 ├─ Contatos            → PF/PJ, timeline unificada, indicado por
 ├─ Pipeline            → Kanban de oportunidades (prospect → fechamento)
 ├─ Pós-venda           → Réguas + NPS com gatilhos por nota
 ├─ Recorrências        → Cadências automáticas
 ├─ Aniversários        → Pessoas + Contratos (renovação)
 ├─ Inteligência (RFM)  → Classificação VIP / Risco / Inativo
 └─ Relatórios          → Funil, conversão, NPS, CAC, ticket médio
```

## Fase 1 — Fundamentos (organização)
- `birth_date` em `crm_contacts` e `profiles`; `contact_role` (cliente/fornecedor/funcionário/parceiro).
- `crm_tasks` (tarefas CRM independentes das operacionais).
- `crm_message_templates` com **variáveis dinâmicas** (`{nome}`, `{empresa}`, `{ultimo_produto}`, `{dias_sem_compra}`, `{valor_ultimo_pedido}`).
- Job diário (pg_cron 08:00) para aniversários (D+7 e D0) com lembrete flutuante.
- Tela "Aniversários" (calendário + filtros).
- Visão Geral com agenda do dia.

## Fase 2 — Receita imediata (Pipeline + Renovações + Pós-venda)

### 2A. Pipeline de Vendas
- `crm_opportunities`: contato, estágio, valor estimado, probabilidade %, data prevista, dono, origem, motivo de perda.
- `crm_pipeline_stages` (configurável): Prospecção → Qualificação → Proposta → Negociação → Fechado-Ganho/Perdido.
- Kanban drag-and-drop, filtros por dono/origem/valor.
- KPIs: valor em pipeline, ticket médio, taxa de conversão por estágio, ciclo médio.

### 2B. Renovações de contrato
- Campos `contract_start`, `contract_end`, `contract_value`, `contract_recurrence` em `companies` e `crm_contacts`.
- Job diário detecta vencimentos em **D-60, D-30, D-15, D-7** → cria oportunidade automática "Renovação" + tarefa para dono da conta.
- Alerta flutuante para gestores comerciais.

### 2C. Pós-venda + NPS com gatilhos
- `crm_postsale_rules` + `crm_postsale_steps` (D+1, D+7, D+30 configurável por setor/categoria).
- Captura de NPS via WhatsApp; resposta dispara automação:
  - **9–10 (Promotor)** → mensagem com link Google Reviews + convite indicação.
  - **7–8 (Neutro)** → tarefa de follow-up qualitativo.
  - **0–6 (Detrator)** → ticket "Gestão de Crise" prioridade alta para supervisão.

### 2D. Programa de indicações
- Campo `referred_by_contact_id` em `crm_contacts`.
- Relatório "Top indicadores" + bonificação manual rastreável.

## Fase 3 — Relacionamento contínuo
- Recorrências de atendimento (semanal/mensal/trimestral/anual) com tarefa automática.
- Templates por evento (aniversário, pós-venda, renovação, recuperação).
- Configurações em **Configurações → CRM**: cadências, antecedências, responsáveis padrão por categoria.

## Fase 4 — Inteligência e crescimento

### 4A. RFM (Recência, Frequência, Valor)
- View materializada `crm_rfm_scores` recalculada por job mensal (1º dia 02:00).
- Score 1–5 em cada eixo → segmentos: **VIP, Fiel, Em risco, Inativo, Novo, Detrator**.
- Filtros e badges nos contatos; campanhas direcionadas por segmento.

### 4B. Alerta de churn
- Detecta cliente recorrente sem interação por X dias (configurável por categoria).
- Cria tarefa crítica de resgate + alerta para dono da conta.

### 4C. Timeline unificada do cliente
- Aba "Timeline" no detalhe do contato agregando:
  - Compras / pedidos (GSystem)
  - Tickets de atendimento
  - Mensagens WhatsApp (Z-API)
  - Respostas NPS
  - Oportunidades e estágios
  - Tarefas CRM concluídas

### 4D. Dashboard Comercial
- Funil de conversão por estágio
- Ticket médio, ciclo médio, win rate
- CAC (custo manual por canal de origem)
- Receita prevista vs realizada
- NPS consolidado (promotores, neutros, detratores)
- Export CSV/XLSX/PDF

## Detalhes técnicos

**Migrations principais:**
- `ALTER crm_contacts`: `birth_date`, `contact_role`, `referred_by_contact_id`, `rfm_segment`, `last_interaction_at`
- `ALTER companies`: `contract_start`, `contract_end`, `contract_value`, `contract_recurrence`
- `ALTER profiles`: `birth_date`
- Novas: `crm_tasks`, `crm_message_templates`, `crm_pipeline_stages`, `crm_opportunities`, `crm_postsale_rules`, `crm_postsale_steps`, `crm_postsale_queue`, `crm_recurring_contacts`, `crm_nps_responses`, `crm_rfm_scores`
- RLS: admin/gestor manage; atendente vê apenas o atribuído a ele

**Server functions** (`src/lib/crm.functions.ts`, `crm-pipeline.functions.ts`, `crm-rfm.functions.ts`):
- Listagens, mutações, daily/monthly jobs, render de templates com variáveis.

**Cron** (rotas em `src/routes/api/public/hooks/`):
- `crm-daily` (08:00) — aniversários, renovações, recorrências, churn, pós-venda
- `crm-rfm-monthly` (1º dia 02:00) — recálculo RFM

**Trigger ticket finalizado**: hook em `ticket-finalize.functions.ts` enfileira passos de pós-venda conforme regra ativa.

**UI** (rotas):
- `crm.tsx` vira layout `<Outlet/>`
- `crm.index.tsx`, `crm.contatos.tsx`, `crm.pipeline.tsx`, `crm.pos-venda.tsx`, `crm.recorrencias.tsx`, `crm.aniversarios.tsx`, `crm.inteligencia.tsx`
- `configuracoes.crm.tsx` (regras, cadências, templates, estágios)
- Aba Timeline integrada ao detalhe do contato

## Sequência de entrega aprovada
1. **Fase 1** — Fundamentos
2. **Fase 2** — Pipeline + Renovações + Pós-venda/NPS + Indicações
3. **Fase 3** — Recorrências + Templates avançados
4. **Fase 4** — RFM + Churn + Timeline + Dashboard Comercial

Aprovando este plano, inicio pela **Fase 1 + Fase 2** (entrega de maior impacto financeiro) em sequência.
