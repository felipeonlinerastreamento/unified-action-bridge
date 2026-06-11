# Corrigir Dashboard — Finalizados Hoje não atualiza

## Causa raiz

O dashboard (`src/routes/dashboard.tsx`) usa uma única query que faz `select` em `service_tickets` sem filtro nem ordenação:

```ts
supabase.from("service_tickets").select("id, status, created_at, closed_at, ...")
```

O backend já tem **2.319 tickets** (2.203 finalizados). O Supabase retorna no máximo 1.000 linhas por requisição. Sem `order by created_at desc` nem range, os tickets finalizados de hoje ficam fora do conjunto retornado, e os KPIs derivados (Finalizados Hoje, Tempo Médio, Operadores, SLA) ficam desatualizados.

## Correção

Reescrever as queries do dashboard para nunca depender de "todos os tickets em memória":

1. **`dashboard-ticket-stats`** — dividir em queries menores e específicas:
   - `openTickets` / `inProgressTickets`: filtrar por `status in ('aberto','em_andamento','reaberto')` (poucos registros, cabe).
   - `closedToday`: filtrar `status = 'finalizado'` + `closed_at >= início_do_dia_local` com `order closed_at desc`.
   - `closedLast30d` (para Tempo Médio / SLA / Operadores): filtrar `status = 'finalizado'` + `closed_at >= now() - 30d` com `order closed_at desc` e `limit 1000`. Hoje a média é calculada sobre TODOS os finalizados, o que além de errado pelo limite, polui métricas com tickets antigos.
   - Adicionar `refetchInterval: 30000` nas novas queries que precisam (já existe na principal).

2. **Recalcular agregações** (`operatorStats`, `slaBreach`, distribuição por status, "Últimos atendimentos") a partir das listas certas:
   - Status / distribuição → contagens vindas das queries de abertos + finalizados recentes.
   - Operadores e SLA → janela de 30 dias (configurável depois).
   - "Últimos atendimentos" → query separada `order created_at desc limit 8`.

3. **Janela de "hoje"** — usar início do dia no fuso local do navegador (já é o comportamento de `new Date(y,m,d)`), garantindo que o filtro server-side em `closed_at` seja convertido para ISO antes de mandar ao Supabase.

## Fora de escopo

- Não mexer em outras telas (Atendimentos, Relatórios). A correção é isolada ao arquivo `src/routes/dashboard.tsx`.
- Não trocar para realtime — `refetchInterval: 30000` já existente é suficiente para o caso.

## Verificação

- Após o fix, conferir no preview que "Finalizados Hoje" mostra o valor compatível com:
  `SELECT count(*) FROM service_tickets WHERE status='finalizado' AND closed_at >= date_trunc('day', now())`.
- Conferir que "Últimos Atendimentos" lista os mais recentes (ordenados por `created_at desc`).
