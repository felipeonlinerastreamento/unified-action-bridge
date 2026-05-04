## Gatilhos por palavra-chave em mensagens

Sistema configurável que monitora mensagens recebidas no WhatsApp e dispara ações automáticas quando detecta palavras-chave (ex.: "Ignição ligado", "Urgente", "Recorrente").

### Ações suportadas
1. **Balão flutuante** — exibe alerta na tela para destinatários definidos (todos do setor, setor específico, usuários específicos, ou operador atribuído).
2. **Encaminhamento automático** — move o chat para um setor (ex.: "Recorrente" → setor "Gestão") e registra evento.
3. **(Opcional) Som** — beep ao disparar o balão.

### Banco de dados (nova migração)

**`message_trigger_rules`**
- `id`, `name`, `is_enabled`
- `keywords jsonb` — lista de termos (ex.: `["ignição ligado", "urgente"]`)
- `match_type` — `any` (qualquer palavra) | `all` | `regex`
- `case_sensitive bool`
- `action_type` — `floating_alert` | `transfer_sector` | `both`
- `alert_message text`
- `alert_target_type` — `assigned` | `all` | `sector` | `users`
- `alert_target_sector_ids jsonb`, `alert_target_user_ids jsonb`
- `transfer_sector_id`, `transfer_sector_name`, `transfer_note`
- `sound_enabled bool`, `cooldown_minutes int`
- `priority int` (ordem de avaliação)

**`message_trigger_logs`**
- `id`, `rule_id`, `chat_id`, `message_id`, `phone`, `contact_name`
- `matched_keyword`, `message_excerpt`
- `action_taken jsonb`, `triggered_at`
- `recipient_user_id`, `acknowledged_at` (para alertas)

RLS: leitura por autenticados; gestão por admin/gestor.

### Detecção (webhook de entrada)

Em `src/routes/api.public.zapi-webhook.$channelId.tsx`, após persistir a mensagem inbound (e antes do CSAT/bot), avaliar regras ativas:
- Normalizar texto (lowercase, sem acento).
- Para cada regra, testar match.
- Em match:
  - Se `floating_alert` ou `both`: inserir log em `message_trigger_logs` para cada destinatário-alvo (resolvendo `assigned`/`sector`/`users`).
  - Se `transfer_sector` ou `both`: atualizar `zapi_chats.sector_name`/`assigned_to` (limpar) e inserir registro em `attendance_event_logs`.

### Balão flutuante (cliente)

Novo componente `src/components/message-trigger-alert.tsx`, mesmo padrão do `chat-inactivity-alert.tsx`:
- Realtime subscribe em `message_trigger_logs` filtrando `recipient_user_id = me` e `acknowledged_at IS NULL`.
- Renderiza balão (vermelho para "Urgente", âmbar padrão) com palavra detectada, trecho da mensagem, contato e botões "Abrir conversa" / "Visto".
- Som opcional + cooldown via `localStorage`.
- Montar em `src/components/app-layout.tsx`.

### UI de configuração

Novo card `src/components/configuracoes/message-triggers-config.tsx` adicionado em **Configurações → Z-API & Bot** (`src/routes/configuracoes.zapi.tsx`):
- Lista de regras com toggle ativo/inativo, editar, excluir.
- Modal de edição:
  - Nome, palavras-chave (chips), tipo de match, case sensitive.
  - Ação: alerta / transferência / ambas.
  - Mensagem do alerta, destinatários (assigned/all/sector/users com pickers).
  - Setor destino da transferência + observação.
  - Som, cooldown, prioridade.
- Pré-cadastrar 2 regras de exemplo (desativadas):
  - "Ignição ligado" → alerta para todos do setor.
  - "Urgente" → alerta para todos do setor + som.
  - "Recorrente" → transferência para setor "Gestão".

### Auditoria

Nova aba **"Gatilhos"** em **Relatórios** (`src/components/relatorios/message-triggers-tab.tsx`):
- KPIs: total de disparos, regra mais acionada, alertas pendentes.
- Tabela com data, regra, palavra detectada, contato, ação tomada, destinatário, status (visto/pendente).
- Exportação CSV.

### Arquivos

Criar:
- `supabase/migrations/..._message_triggers.sql`
- `src/components/message-trigger-alert.tsx`
- `src/components/configuracoes/message-triggers-config.tsx`
- `src/components/relatorios/message-triggers-tab.tsx`

Editar:
- `src/routes/api.public.zapi-webhook.$channelId.tsx` (avaliação das regras)
- `src/routes/configuracoes.zapi.tsx` (montar card)
- `src/components/app-layout.tsx` (montar balão)
- `src/routes/relatorios.tsx` (nova aba)
