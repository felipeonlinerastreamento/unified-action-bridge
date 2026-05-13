## Problema observado (5521999073679)

- Última ticket finalizada em **05/07** (chat finalizado, prompt de CSAT enviado, cliente não respondeu).
- Cliente voltou em **05/13** e o webhook reabriu o chat para `aguardando` silenciosamente, mas **nenhum novo `service_ticket`/protocolo foi aberto**.
- Operadora respondeu manualmente; o chat passou para `em_atendimento` mantendo o histórico antigo, sem novo protocolo, sem TMA, sem rastreio.

A causa é que a reabertura silenciosa do webhook não cria ticket; ticket só é criado quando o operador interage via UI (`createTicketMutation` em `central.tsx`). Se o cliente volta em horário comercial, vira o atendimento sem protocolo.

Além disso, a atribuição automática só acontece dentro do bot (nodes `route_to_*`). Reaberturas, mensagens fora-do-bot e grupos ficam **sem `assigned_to`**, e nada distribui pelo operador menos carregado.

## Mudanças propostas

### 1. Abrir novo protocolo automaticamente ao reabrir chat (CSAT não respondida)

Local: `src/routes/api.public.zapi-webhook.$channelId.tsx`, dentro do bloco `shouldReopen` (linhas ~518-551).

Quando reabrir um chat finalizado:
- Verificar se existe `service_ticket` aberto (`status != 'finalizado'`) para `attendance_id = chat.id`.
- Se não existir, **criar um novo ticket**:
  - `attendance_id = chat.id`, `channel_id`, `contact_phone = phone`, `contact_name`, `status = 'aberto'`, `opened_by = null`.
  - Sem CSAT respondida no ciclo anterior → registrar metadado (ex.: nota interna "Reabertura sem avaliação CSAT do protocolo anterior #N") referenciando `protocol_number` do último ticket finalizado.
- Esse novo ticket vai gerar `protocol_number` automaticamente (sequência já existente), garantindo um novo protocolo para o atendimento.

### 2. Atribuição automática ao operador menos carregado em toda reabertura/criação

Local: mesmo bloco do webhook (insert de chat novo + reopen) e também no fluxo de grupos.

Regra:
- Sempre que o webhook **criar** um chat (linha ~450) ou **reabrir** um chat finalizado (linha ~544), e `assigned_to` estiver `null`, chamar `pick_least_loaded_agent`:
  - Para chats individuais: usar `sector_name` existente, ou `'Atendimento'` como padrão.
  - Para **grupos**: também aplicar o mesmo (atualmente grupos passam direto sem bot e sem atribuição). Definir `sector_name = 'Atendimento'` se vazio e atribuir.
- Se `pick_least_loaded_agent` retornar `null` (nenhum operador disponível/online), manter `assigned_to = null` e logar; cai na fila normalmente.
- Atualizar `zapi_chats.assigned_to` e `status = 'em_atendimento'` (em vez de `'aguardando'`) quando houver atribuição direta — para que o ticket criado no passo 1 já fique vinculado ao operador.

### 3. Vincular o novo ticket ao operador atribuído

No insert do ticket (passo 1), preencher `assigned_to` com o `user_id` retornado por `pick_least_loaded_agent`, para que o protocolo nasça já com dono e entre nas métricas do operador.

### 4. Grupos: novo protocolo por janela de atendimento

Para grupos, aplicar a mesma lógica: ao receber mensagem em grupo finalizado (após o `groupReopenGuard` de 60s), reabrir + criar novo `service_ticket` com `assigned_to` do operador menos carregado. Hoje grupos só geram ticket no momento do finalize via `resolveGroupTicketStart` — isso continua válido para o cálculo de TMA, mas o protocolo passa a existir desde a reabertura.

## Detalhes técnicos

- Função SQL `pick_least_loaded_agent(_sector text)` já existe e considera presença (`last_seen_at`), disponibilidade (`is_chat_available`) e contagem de chats `em_atendimento`. Reutilizar via `supabaseAdmin.rpc("pick_least_loaded_agent", { _sector })`.
- Adicionar helper interno no webhook (`assignLeastLoaded(chatId, sector)`) para evitar duplicação entre os ramos "criar chat" e "reabrir chat".
- Não alterar a lógica do bot existente (route_to_least_loaded continua funcionando). A nova atribuição é aplicada **antes** do bot rodar — se for chat individual em horário comercial e o bot estiver ativo, o bot pode reatribuir (último vence).
  - Para evitar conflito: aplicar atribuição automática **apenas quando não houver fluxo de bot configurado** OU **quando a reabertura for silenciosa** (`justReopenedSilently = true`).
  - Para grupos e reaberturas silenciosas: sempre atribuir.
- Não criar duplicidade de ticket: sempre conferir se já há ticket aberto para `attendance_id` antes do insert.

## Sem mudanças

- UI da Central, fluxo de finalize, CSAT, métricas, RLS, schema (não há nova coluna).
- `zapi_chats` segue identificando por `phone` (nada de chats duplicados).
