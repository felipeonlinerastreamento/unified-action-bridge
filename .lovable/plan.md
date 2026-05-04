## Objetivo

Adicionar um novo bloco "Lembrete recorrente de pendências" dentro da configuração do Popup Diário. Diferente do popup de boas-vindas (1x/dia), esse popup re-aparece a cada X horas durante o expediente, mostrando contagens e listas dos itens em aberto, segmentados por:

- **Chats em aberto** (Z-API, fila de atendimento)
- **Atendimentos (tickets) atribuídos ao operador logado**
- **Atendimentos (tickets) do(s) setor(es) que o operador faz parte**

Configurável globalmente por admin/gestor, com escopo de quem recebe (todos / por setor / por usuário).

## Mudanças

### 1. Banco — nova tabela `pending_reminder_settings`

Migração com:
- `id`, `is_enabled` (bool, default true)
- `interval_hours` (numeric, default 2) — frequência do popup
- `quiet_start` / `quiet_end` (text "HH:MM") — só dispara dentro desse intervalo (default 08:00–18:00)
- `weekdays` (int[] 0–6, default {1..5})
- `target_type` (text: `all` | `sector` | `users`) — quem recebe
- `target_sector_ids` (uuid[]) — quando `sector`
- `target_user_ids` (uuid[]) — quando `users`
- `show_open_chats` (bool, default true)
- `show_my_tickets` (bool, default true)
- `show_sector_tickets` (bool, default true)
- `min_total_to_show` (int, default 1) — não abre se total = 0
- `sound_enabled` (bool, default false)
- `updated_at`, `updated_by`

RLS: SELECT para qualquer autenticado; ALL para admin/gestor (mesmo padrão de `daily_welcome_settings`).

### 2. UI de configuração — `src/routes/configuracoes.popup-diario.tsx`

Acrescentar uma nova seção (Card) abaixo de "Seções de pendências" chamada **"Lembrete recorrente de pendências"** com:

- Switch "Ativar lembrete recorrente"
- Input numérico "A cada X horas" (0.5–24, aceita decimais)
- Dois inputs `time` para janela ativa (início/fim)
- Checkboxes dos dias da semana
- Select "Destinatários": Todos / Por setor / Por usuário
  - Quando `sector`: multi-select de setores (carregados de `sectors`)
  - Quando `users`: multi-select de usuários (carregados de `profiles`)
- Toggles de conteúdo: chats em aberto, meus atendimentos, atendimentos do meu setor
- Toggle "Som ao abrir"
- Botão "Pré-visualizar" (limpa o timestamp local e abre o popup imediatamente)
- Botão "Salvar"

### 3. Novo componente — `src/components/pending-reminder-popup.tsx`

Hook + Dialog que:

1. Carrega `pending_reminder_settings` (React Query, staleTime 5min).
2. Carrega setores do usuário via `user_sector_assignments` para saber quais tickets de setor mostrar.
3. Verifica elegibilidade: `is_enabled`, dia da semana, janela de horário, e se o usuário está no `target_*`.
4. Usa `localStorage` chave `pending-reminder:last:<userId>` com timestamp da última exibição. Se `now - last >= interval_hours`, agenda exibição.
5. `setInterval` a cada 60s reavalia (e usa `visibilitychange` para reavaliar ao voltar pra aba).
6. Dispara queries (em paralelo) condicionais aos toggles:
   - `zapi_chats` em status `aguardando` / `em_atendimento` (totais e top 5)
   - `service_tickets` em `aberto`/`em_andamento` com `assigned_to = user.id`
   - `service_tickets` em `aberto`/`em_andamento` cujo `sector` ∈ setores do usuário
7. Se total < `min_total_to_show`, não abre, mas atualiza o timestamp para evitar re-checagem imediata.
8. Dialog mostra 3 seções (chats, meus atendimentos, atendimentos do setor) com contagem, top 5 itens e link "Ver todos" para `/central` ou `/atendimentos`.
9. Toca um beep curto se `sound_enabled` (Web Audio API, sem dependência nova).
10. Botões: "Adiar 15 min" (avança timestamp pra now-interval+15min) e "OK" (marca como visto).

### 4. Montagem global

Adicionar `<PendingReminderPopup />` em `src/components/app-layout.tsx` (mesmo lugar do `DailyWelcomeDialog`), atrás de `isAuthenticated`.

### 5. Tipos

Como `daily_welcome_settings` já é acessada via `as any`, seguir o mesmo padrão para `pending_reminder_settings` até o `types.ts` regenerar automaticamente após a migração.

## Detalhes técnicos

- Setores do usuário: `select sector_id from user_sector_assignments where user_id = auth.uid()`, depois `select id, name from sectors where id in (...)`. Para casar com `service_tickets.sector` (que é texto/nome), filtrar por `sector in (nomes)`.
- Para `zapi_chats`, contar onde `status in ('aguardando','em_atendimento')`. Sem filtro extra (visibilidade global da fila — segue o padrão da Central).
- `interval_hours` armazenado como numeric permite `0.5` (30min). UI valida min 0.25.
- O popup nunca abre simultâneo ao `DailyWelcomeDialog`: ao mostrar, checa se já existe um `[role=dialog]` aberto e adia 30s.
- Pré-visualização: remove a chave `pending-reminder:last:` do usuário e força reavaliação imediata.

## Fora de escopo

- Notificação push/desktop nativa (só popup in-app).
- Disparo server-side (cron) — o gatilho é client-side por usuário logado, suficiente para o caso de uso.
- Histórico de exibições (não persiste no DB).
