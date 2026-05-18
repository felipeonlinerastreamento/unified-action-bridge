## Objetivo

Automatizar o fluxo do comunicado "Placas sem comunicação": detectar a mensagem (enviada por nós OU recebida do cliente), gerar protocolo, anexar rodapé com o número, e finalizar o chamado com categoria **Sem comunicação** e status **resolvido**. Tudo controlado por uma tela em **Configurações** com ativar/desativar e gestão das frases-chave.

## 1. Banco de dados (migration)

Nova tabela `no_communication_automation_settings` (singleton):
- `id`, `singleton bool default true unique`
- `is_enabled bool default false`
- `direction text` — `'inbound' | 'outbound' | 'both'` (default `'both'`)
- `footer_template text` — default `'Atendimento de protocolo: {numero do protocolo}'`
- `keywords text[]` — frases-chave (default `['placas sem comunicação','atraso de comunicação']`)
- `match_mode text` — `'any' | 'all'` (default `'any'`, case-insensitive, acento-insensível)
- `auto_close bool default true` — fecha o chamado após enviar rodapé
- `category text default 'Sem comunicação'`, `final_status text default 'resolvido'`
- `updated_by`, `updated_at`

Tabela de auditoria `no_communication_automation_log`:
- `id`, `chat_id`, `ticket_id`, `protocol_number`, `direction`, `matched_keyword`, `triggered_at`, `triggered_by` (system/user), `message_excerpt`

RLS:
- Settings: SELECT admin + gestor com `can_access_ai_manager` (mesmo padrão); UPDATE/INSERT só admin.
- Log: SELECT admin + gestor; INSERT via server (service role).

Garantir categoria "Sem comunicação" no enum/lista de categorias de ticket (criar se não existir).

## 2. Geração de protocolo

Função SQL `generate_no_comm_protocol()` que retorna número sequencial formatado (ex.: `SC-2026-000123`) usando sequence dedicada `no_comm_protocol_seq`.

## 3. Server functions (`src/lib/no-comm-automation.functions.ts`)

- `getNoCommSettings()` (GET) — admin/gestor.
- `updateNoCommSettings(input)` (POST, admin) — Zod valida `is_enabled`, `direction`, `footer_template` (max 500, deve conter `{numero do protocolo}`), `keywords` (1–20 itens, cada 3–120 chars), `match_mode`, `auto_close`.
- `processChatMessageForNoComm({ chatId, messageBody, direction })` (POST, server-only chamada interna) — núcleo:
  1. Carrega settings; se `is_enabled=false` ou direção não casa → retorna `{matched:false}`.
  2. Normaliza texto (lower + remove acentos) e testa keywords conforme `match_mode`.
  3. Se casar: gera protocolo, monta rodapé substituindo `{numero do protocolo}`, envia mensagem de rodapé pelo mesmo canal Z-API usado hoje.
  4. Se houver ticket aberto vinculado ao chat → fecha (categoria + status final + nota com protocolo). Se não houver → cria ticket já finalizado.
  5. Insere registro em `no_communication_automation_log`.
  6. Retorna `{matched:true, protocol, ticketId}`.

## 4. Pontos de detecção (gancho)

- **Outbound**: no caminho onde o operador envia mensagem pelo chat (componente de envio do Central de Atendimento → server fn `sendChatMessage`/equivalente), após sucesso do envio chamar `processChatMessageForNoComm` com `direction='outbound'`.
- **Inbound**: no webhook/poll que ingere mensagens recebidas do Z-API, após persistir a mensagem, chamar com `direction='inbound'`.

Idempotência: log indexado por `(chat_id, message_id)` para não duplicar.

## 5. UI — Configurações

Nova entrada no menu lateral de **Configurações** → "Automação Sem Comunicação" (`src/routes/_authenticated/configuracoes/automacao-sem-comunicacao.tsx` ou aba dentro do Configurações existente — seguir padrão atual).

Card único `NoCommAutomationCard`:
- **Switch grande "Ativar automação"** (controla `is_enabled`).
- Select **Direção**: Enviada por nós / Recebida do cliente / Ambos.
- Textarea **Rodapé** com chip explicando `{numero do protocolo}`.
- Lista editável de **Frases-chave** (add/remove tags) + toggle "Casar qualquer / Casar todas".
- Switch **Finalizar chamado automaticamente** + select de **Categoria** e **Status final** (defaults preenchidos).
- Botão **Salvar** (admin only — desabilita inputs para gestor read-only).
- Painel "Últimos disparos" (10 mais recentes do log) com chat, protocolo, data, direção.

## 6. Arquivos

**Criar:**
- `supabase/migrations/..._no_comm_automation.sql`
- `src/lib/no-comm-automation.functions.ts`
- `src/components/settings/no-comm-automation-card.tsx`
- `src/routes/_authenticated/configuracoes/automacao-sem-comunicacao.tsx` (ou aba)

**Editar:**
- Server fn de envio de mensagem do chat (hook outbound).
- Ingestão de mensagens Z-API (hook inbound).
- Menu de Configurações (adicionar item).

## Detalhes técnicos

- Normalização: `text.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()` antes do match.
- Protocolo gerado via `nextval('no_comm_protocol_seq')` dentro de função `SECURITY DEFINER`.
- Rodapé enviado como mensagem separada (não concatena no texto original) para preservar histórico.
- Quando `auto_close=false`: só envia rodapé e registra log, não mexe no ticket.
- Validação no save: bloquear ativar se `keywords` vazio.
