
# Módulo OKR — Objectives & Key Results

Sistema completo de gestão de OKRs integrado ao app, com 3 níveis (Empresa, Setor, Individual), ciclos configuráveis por OKR, Key Results automáticos (alimentados por métricas do sistema) ou manuais, e alertas via sistema de notificações já existente.

## Conceitos

- **Objective**: meta qualitativa com prazo (ex: "Elevar qualidade do atendimento no Q2/2026").
- **Key Result (KR)**: métrica numérica do objetivo (3-5 por O). Cada KR tem valor inicial, meta e valor atual.
- **Score**: 0 a 100% por KR (calculado: `(atual - inicial) / (meta - inicial)`). Score do Objective = média dos KRs.
- **Confiança**: semáforo verde/amarelo/vermelho atualizado nos check-ins semanais.
- **Cascateamento**: KRs individuais e de setor podem se ligar a um Objective pai (empresa/setor).

## Fluxo do usuário

1. Admin cria ciclos (ex: "Q2/2026", "Maio/2026"). Cada OKR escolhe seu ciclo.
2. Admin/Gestor cria Objectives nos níveis permitidos (empresa/setor/individual).
3. Para cada Objective, cria 1-5 Key Results, escolhendo:
   - **Automático**: liga a uma métrica do sistema (lista pré-definida — ver seção técnica). Atualiza sozinho a cada hora.
   - **Manual**: define quem atualiza e com que frequência. Responsável recebe lembrete semanal.
4. Tela `/okr` mostra todos os Objectives com barra de progresso, score e semáforo de confiança.
5. Check-in semanal: responsável atualiza valor (manual) e confiança, opcionalmente comenta.
6. Alertas automáticos: KR vermelho, prazo próximo (7d/3d/1d), ciclo encerrado.
7. Relatório no menu Relatórios: histórico de scores por ciclo, exportável CSV/PDF.

## Telas a criar

- **`/okr`** — lista geral com filtros (ciclo, nível, setor, responsável, status). Cards por Objective com KRs, progresso e semáforo.
- **`/okr/$objectiveId`** — detalhe: KRs com gráfico de evolução, histórico de check-ins, comentários, log de alterações.
- **`/configuracoes/okr`** — gestão de ciclos (CRUD), permissões (quem pode criar em cada nível), configuração de alertas (quando disparar).
- **Aba "OKR" em `/relatorios`** — gráficos por ciclo, comparativo entre ciclos, ranking por setor/atendente, export CSV/XLSX/PDF.
- **Widget no Dashboard**: top 3 Objectives da empresa + status do meu OKR pessoal.

## Permissões (RBAC já existente)

- **Admin**: tudo (criar/editar/excluir em todos os níveis, gerenciar ciclos).
- **Gestor**: cria/edita Objectives do seu setor + dos atendentes do seu setor; vê empresa.
- **Atendente**: vê tudo da empresa e do seu setor; atualiza KRs manuais que são seus; cria seus próprios OKRs individuais (opcional, configurável).

## Métricas automáticas disponíveis (KRs automáticos)

A partir do que o sistema já coleta:

- **Atendimento**: TMA, tempo de fila, tempo de primeira resposta, total de tickets resolvidos, % SLA verde, nº chats perdidos, nº alertas SLA vermelho.
- **Por atendente**: tickets pessoais resolvidos no período, TMA pessoal, taxa de transferência, taxa de reabertura.
- **Estoque**: nº auto-tickets de estoque baixo, tempo médio de liberação de equipamento.
- **CRM**: nº contatos com empresa vinculada, % contatos com categoria, nº leads convertidos.
- **E-mail**: tickets de e-mail respondidos, tempo médio de primeira resposta de e-mail.

Cada métrica vira um "tipo de KR automático" que o usuário escolhe num combo ao criar o KR. A direção (subir/descer é melhor) e a unidade (min, %, contagem) são pré-configuradas.

## Alertas (integração com sistema de notificações)

Reutiliza tabelas `notifications` e `notification_campaigns` criadas recentemente. Cron horário verifica:

- KR cuja confiança está vermelha há 3+ dias → notifica responsável + gestor.
- Objective com prazo a 7d, 3d, 1d sem check-in na semana → notifica responsável.
- Ciclo encerrando em 3 dias → notifica todos os donos de Objectives do ciclo.
- KR automático que regrediu mais de 20% em 7 dias → notifica responsável + gestor.

## Fases de entrega

**Fase 1 (MVP — entregar primeiro)**
- Tabelas + RLS + tela `/okr` (lista e criação) + KRs manuais + ciclos configuráveis + permissões básicas.

**Fase 2**
- KRs automáticos (engine de cálculo + cron horário) + tela de detalhe com gráfico + check-ins semanais.

**Fase 3**
- Alertas automáticos integrados a notificações + relatório completo + widget no dashboard.

---

## Detalhes técnicos

### Schema do banco

```sql
-- Ciclos (configuráveis por OKR)
create table okr_cycles (
  id uuid primary key default gen_random_uuid(),
  name text not null,                    -- ex: "Q2/2026", "Maio/2026"
  start_date date not null,
  end_date date not null,
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Objectives
create table okr_objectives (
  id uuid primary key default gen_random_uuid(),
  cycle_id uuid not null references okr_cycles(id) on delete restrict,
  level text not null check (level in ('empresa','setor','individual')),
  sector_id uuid references sectors(id) on delete set null,
  owner_user_id uuid references auth.users(id) on delete set null, -- individual
  parent_objective_id uuid references okr_objectives(id) on delete set null, -- cascateamento
  title text not null,
  description text default '',
  status text not null default 'ativo' check (status in ('ativo','concluido','cancelado')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Key Results
create table okr_key_results (
  id uuid primary key default gen_random_uuid(),
  objective_id uuid not null references okr_objectives(id) on delete cascade,
  title text not null,
  kr_type text not null check (kr_type in ('manual','automatico')),
  metric_key text,                       -- ex: 'tma_minutes', 'tickets_resolved'. Null se manual.
  metric_filter jsonb default '{}',      -- ex: {"sector":"Suporte","user_id":"..."}
  unit text default '',                  -- 'min','%','un'
  direction text not null default 'increase' check (direction in ('increase','decrease')),
  initial_value numeric not null default 0,
  target_value numeric not null,
  current_value numeric not null default 0,
  responsible_user_id uuid references auth.users(id),
  confidence text default 'verde' check (confidence in ('verde','amarelo','vermelho')),
  last_auto_update_at timestamptz,
  display_order int default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Check-ins (histórico de updates)
create table okr_checkins (
  id uuid primary key default gen_random_uuid(),
  key_result_id uuid not null references okr_key_results(id) on delete cascade,
  previous_value numeric,
  new_value numeric not null,
  confidence text not null,
  comment text default '',
  source text not null default 'manual' check (source in ('manual','automatico')),
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

-- Configuração de alertas
create table okr_alert_settings (
  id uuid primary key default gen_random_uuid(),
  alert_red_confidence_days int default 3,
  alert_no_checkin_days int default 7,
  alert_cycle_ending_days int default 3,
  alert_regression_threshold_pct numeric default 20,
  is_enabled boolean default true,
  updated_at timestamptz default now()
);
```

RLS:
- `okr_cycles`, `okr_alert_settings`: leitura para todos autenticados; escrita só admin.
- `okr_objectives`/`okr_key_results`/`okr_checkins`:
  - leitura: todo autenticado vê empresa + setor próprio + individuais que é responsável/dono. Admin/Gestor veem mais (gestor: setor próprio + atendentes do setor).
  - escrita: admin sempre; gestor no seu setor; usuário no seu próprio individual (opcional via flag).

### Engine de KR automático

- Função em `src/lib/okr-metrics.server.ts` mapeia cada `metric_key` para uma query Supabase agregando dados do ciclo (entre `start_date` e `end_date`).
- Server function `recomputeAutoKeyResults` roda em cron horário via `/api/public/hooks/okr-auto-update`.
- Para cada KR automático ativo: executa query, atualiza `current_value`, recalcula confiança (com base em `pace esperado vs atual`), grava `okr_checkins` com `source='automatico'`.

### Cron jobs (pg_cron + pg_net)

- `okr-auto-update` — a cada hora.
- `okr-alerts` — diariamente às 9h.

Ambos chamam endpoints `/api/public/hooks/*` no padrão já usado pelo projeto.

### Componentes a criar

- `src/components/okr/objective-card.tsx`
- `src/components/okr/key-result-row.tsx` (com edição inline e modal de check-in)
- `src/components/okr/checkin-dialog.tsx`
- `src/components/okr/objective-form-dialog.tsx`
- `src/components/okr/cycle-management.tsx`
- `src/components/okr/okr-progress-ring.tsx` (ring de progresso reutilizável)
- `src/components/okr/okr-report-charts.tsx` (Recharts)

### Server functions

- `src/lib/okr.functions.ts`: list/create/update/delete objectives e KRs, criar check-in, listar ciclos, métricas disponíveis.
- `src/lib/okr-metrics.server.ts`: catálogo de métricas + queries.
- `src/lib/okr-alerts.server.ts`: lógica de geração de notificações.

### Rotas TanStack

- `src/routes/okr.tsx` (lista)
- `src/routes/okr.$objectiveId.tsx` (detalhe)
- `src/routes/configuracoes.okr.tsx` (config)
- `src/routes/api.public.hooks.okr-auto-update.tsx`
- `src/routes/api.public.hooks.okr-alerts.tsx`

### Integração com app existente

- Sidebar (`src/components/app-sidebar.tsx`): novo item "OKR" com ícone Target.
- `src/routes/relatorios.tsx`: nova aba "OKR".
- `src/routes/dashboard.tsx`: novo widget "Top OKRs".
- Memória do projeto: criar `mem://features/okr-management` e atualizar índice.

## Pergunta final antes de implementar

Confirma que começo pela **Fase 1 (MVP)** — schema completo + tela `/okr` + KRs manuais + ciclos + permissões? As Fases 2 e 3 entrego em sequência, mas separadas para você validar a UX antes da automação.
