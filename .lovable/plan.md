## Objetivo

Adicionar, em **Configurações → Encaminhamento por Categoria**, um novo módulo de **Ociosidade no Chat** que permita criar/editar/excluir regras de mensagens automáticas enviadas ao cliente quando há inatividade — tanto do cliente quanto do operador.

Comportamento padrão (configurável):
- Cliente sem interação por X min (default 5) → envia: `{contactName} ainda está aí? Preciso de uma interação para que o chamado não seja finalizado por inatividade.`
- Operador sem responder por X min (default 5) → envia: `{contactName}, ainda estou aqui analisando sua situação. Já volto com devolutiva.`

Importante: isso é **diferente** do `chat_inactivity_alert_settings` existente, que apenas mostra alerta visual ao operador. O novo módulo **envia mensagem real ao WhatsApp** via Z-API.

---

## 1. Banco de dados (migração)

Nova tabela `chat_idle_auto_messages`:

```text
id                uuid PK
name              text                     -- ex.: "Lembrete cliente 5min"
is_enabled        bool   default true
target            text  check in ('customer','operator')
idle_minutes      int   default 5          -- gatilho
message_template  text                     -- suporta {{contactName}} e {{operatorName}}
cooldown_minutes  int   default 30         -- evita reenviar para o mesmo chat
max_sends_per_ticket int default 2         -- limite por janela de atendimento
sector_filter     text[] default '{}'      -- vazio = todos
channel_id        uuid null                -- null = todos canais
created_at, updated_at
```

Nova tabela `chat_idle_auto_message_logs`:
```text
id, rule_id, chat_id, channel_id, phone, contact_name,
target, idle_minutes_at_send, message_sent, sent_at
```

RLS: leitura/escrita para admin/gestor; insert de log via service role.

Seed automático: 1 regra `customer` (5 min) e 1 regra `operator` (5 min) ativadas com os textos do enunciado.

## 2. Backend — scanner periódico

Nova rota pública `src/routes/api.public.chat-idle-scanner.tsx` (POST):
- Busca regras ativas.
- Para cada regra, varre `zapi_chats` com `status in ('em_atendimento','aguardando')` e `last_message_at < now() - idle_minutes`.
- Determina o "lado" da última mensagem (`zapi_messages.from_me`):
  - regra `customer` dispara quando última msg foi do cliente (`from_me=false`) e tempo > idle.
  - regra `operator` dispara quando última msg foi do operador (`from_me=true`) e tempo > idle.
- Respeita `cooldown_minutes` (consultando `chat_idle_auto_message_logs`) e `max_sends_per_ticket` (logs após o início do ticket atual).
- Envia mensagem via `zapiSendText` (já existente em `lib/zapi.server.ts`), persiste em `zapi_messages` (`from_me=true`), atualiza `last_message_at` e grava log + `attendance_event_logs`.

Substituições no template:
- `{{contactName}}` → `zapi_chats.contact_name || "cliente"`
- `{{operatorName}}` → nome do `assigned_to` em `profiles`

Cron via pg_cron (a cada 1 min) chamando o endpoint público (URL estável `project--{id}.lovable.app`).

## 3. Frontend — UI de CRUD

Novo componente `src/components/configuracoes/chat-idle-auto-messages-config.tsx`:
- Card "Mensagens automáticas por ociosidade" com tabela (Nome, Alvo, Min, Cooldown, Ativo, Ações).
- Botão "Nova Regra" → Dialog com:
  - Nome
  - Alvo (Cliente / Operador) — radio
  - Minutos de ociosidade (number, min 1)
  - Cooldown (min)
  - Máx envios por atendimento
  - Mensagem (textarea com hint de variáveis disponíveis)
  - Switch ativo
- Editar/Excluir/Toggle (mesmos padrões já usados em `EncaminhamentoPage`).

Inserir o componente em `src/routes/configuracoes.encaminhamento.tsx`, logo após `<EscalonamentoGestaoConfig />` e antes do card "Regras de Encaminhamento".

## 4. Detalhes técnicos

- Uso de `supabaseAdmin` no scanner (service role) — endpoint em `/api/public/*` mas com guarda por header `apikey` (anon) para evitar abuso.
- Reaproveitar helper de envio Z-API (`zapiSendText`) e persistência igual à do `zapi-bot.server.ts` (`persistOutgoing`).
- Não enviar para chats em `status='finalizado'` ou `status='bot'`.
- Para grupos (`isGroup`): por padrão desativado (campo extra `apply_to_groups bool default false` na regra) para evitar spam em grupos.

## Resumo dos arquivos

- Novo: migração SQL (tabelas + RLS + seeds)
- Novo: `src/routes/api.public.chat-idle-scanner.tsx`
- Novo: `src/components/configuracoes/chat-idle-auto-messages-config.tsx`
- Editado: `src/routes/configuracoes.encaminhamento.tsx` (montar o card)
- Cron job no Supabase chamando o endpoint a cada minuto
