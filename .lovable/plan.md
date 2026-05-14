## Objetivo

Quando o operador finalizar uma conversa com status **"A resolver"**, o protocolo (ticket) **não deve ser encerrado**. O chat sai da Central de Atendimento, mas:

- O `service_ticket` permanece **aberto** (não recebe `closed_at`, mantém `protocol_number` original).
- Quando o cliente enviar nova mensagem, o chat reabre **no mesmo protocolo**, atribuído ao **mesmo operador** que marcou "A resolver", **sem disparar bot/saudação**.
- Apenas a finalização como **"Resolvido"** encerra o ticket de fato e gera novo protocolo na próxima interação.

---

## Mudanças

### 1. Finalização "A resolver" — `src/routes/central.tsx` (`finalizeMutation`)

Detectar `status === "A resolver"` (renomear variável para `pendingResolve = status === "A resolver"`) e quando verdadeiro:

- **NÃO** atualizar `service_tickets.status` para `finalizado`. Mantém ticket como `aberto` (ou cria novo já como `aberto` em vez de `finalizado` no fallback das linhas 1620-1655 e 1990-2026).
- **NÃO** chamar `concluirPendencia` no GSystem (já é o caso, só dispara em `Resolvido`).
- **NÃO** rodar `finalizeTicketWithFlow` (pular bloco 2029-2054 quando `pendingResolve`).
- **NÃO** enviar mensagem de fechamento/CSAT (`sendText` linhas 1909-1939 e bloco CSAT acima — pular quando `pendingResolve`).
- **SIM** fechar o `zapi_chat`: marcar com novo status `aguardando_retorno` (em vez de `finalizado`) e gravar `assigned_to` preservado + nova coluna `pending_resolve_user_id`. Isso tira da Central (queries de chats abertos filtram `status in ('aguardando','em_atendimento','bot')`) mas distingue de finalização real.

### 2. Schema — migração

Adicionar em `zapi_chats`:
- `pending_resolve_user_id uuid` — operador que marcou "A resolver".
- `pending_resolve_ticket_id uuid` — referência ao ticket que deve ser reutilizado no retorno.
- `pending_resolve_at timestamptz`.

Sem mexer em `service_tickets` (continua `status='aberto'` com `protocol_number` já existente).

### 3. Reabertura no webhook — `src/routes/api.public.zapi-webhook.$channelId.tsx`

No bloco `shouldReopen` (linha ~811-887):

- Detectar caso "pending resolve": `existing.status === 'aguardando_retorno'` (ou `existing.pending_resolve_ticket_id != null`).
- Quando for pending-resolve:
  - **NÃO** chamar `ensureOpenTicketForChat` (não criar novo ticket — o anterior continua aberto).
  - Atribuir `assigned_to = existing.pending_resolve_user_id` (se o operador estiver online via `pick_least_loaded_agent` check; caso offline, cair para least-loaded do setor).
  - Definir `status = 'em_atendimento'`.
  - Limpar campos `pending_resolve_*`.
  - Marcar `justReopenedSilently = true` (já existe) → garante que o bot não rode (linha 975 já respeita).
- Caso normal de `finalizado` permanece como hoje (cria novo ticket/protocolo).

### 4. UI

- Toast de finalização: "Atendimento marcado como A resolver — protocolo {N} continua aberto" quando `pendingResolve`.
- Mensagem do diálogo de finalização: pequena nota explicando que "A resolver" mantém o protocolo aberto.

---

## Detalhes técnicos

**Por que `aguardando_retorno` em vez de `finalizado`:** todos os filtros existentes que listam chats ativos checam `status != 'finalizado'`. Usar um status novo evita que o chat apareça na Central, mas também evita que o webhook execute o caminho "reabrir = novo protocolo". O webhook ganha um branch dedicado para esse status.

**Auditoria:** registrar evento `chat_pending_resolve` em `audit_logs` (categoria `attendance`) com `ticket_id` e `protocol_number`, reutilizando `logAuditEvent` já existente.

**Sem mudanças** em: GSystem sync, fluxos de roteamento (TE / category rules), CSAT, escalonamento. Esses só rodam em "Resolvido".

---

## Arquivos afetados

- `src/routes/central.tsx` (mutationFn de `finalizeMutation`, copy do diálogo, toast)
- `src/routes/api.public.zapi-webhook.$channelId.tsx` (branch de reabertura)
- Migração SQL: novas colunas em `zapi_chats`
- `src/lib/audit.functions.ts` / `.server.ts` (novo `event_type`)
