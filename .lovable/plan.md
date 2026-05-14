## Menu de Auditoria — `/configuracoes/auditoria`

Nova página em Configurações que armazena e exibe um log completo de eventos do sistema, com filtros e exportação.

### 1. Banco de dados

Nova tabela `public.audit_logs`:

- `id` (uuid)
- `created_at` (timestamptz)
- `user_id` (uuid, opcional — quem executou)
- `user_name` (text, snapshot do nome no momento)
- `event_category` (text) — `auth`, `presence`, `contact_link`, `crm`, `ticket`, `task`, `okr`
- `event_type` (text) — ex.: `login`, `logout`, `set_offline`, `set_online`, `contact_linked_company`, `subclient_created`, `crm_contact_created`, `crm_contact_updated`, `crm_contact_deleted`, `ticket_created`, `ticket_finalized`, `ticket_transferred`, `task_created`, `task_assigned`, `task_completed`, `okr_created`, `kr_created`, `kr_checkin`
- `target_type` / `target_id` / `target_label` (text/uuid/text)
- `metadata` (jsonb) — payload livre (telefone normalizado, empresa, valores antes/depois, motivo, etc.)
- `ip_address` (text), `user_agent` (text)

RLS:
- SELECT: somente `admin` ou `gestor` (via `has_role`).
- INSERT: feito apenas por server functions usando `supabaseAdmin` — sem policy de insert para usuários.

Retenção: **indefinida** (sem job de limpeza).

Índices: `created_at desc`, `(event_category, created_at)`, `(user_id, created_at)`, `(target_type, target_id)`.

### 2. Server functions (`src/lib/audit.functions.ts`)

- `logAuditEvent` — chamada interna (passada via import direto a outras server fns) e também exposta para casos client-side controlados (login/offline). Recebe categoria, tipo, target, metadata; resolve `user_id`/`user_name` via `requireSupabaseAuth` quando disponível; grava com `supabaseAdmin`.
- `listAuditLogs` — protegida (`requireSupabaseAuth` + checagem `admin`/`gestor`); aceita filtros `{ category[], event_type[], user_id[], date_from, date_to, search, limit, cursor }`; paginação por cursor `created_at`.
- `exportAuditLogs` — gera CSV server-side com os mesmos filtros.

### 3. Instrumentação (pontos de log)

| Evento | Onde | Como |
|---|---|---|
| Login | `useAuth` `onAuthStateChange` SIGNED_IN | `logAuditEvent('auth','login')` |
| Logout | `useAuth.signOut` | `logAuditEvent('auth','logout')` |
| Offline / Online | `chat-availability-toggle.tsx` ao alternar `is_chat_available` | `set_offline` / `set_online` |
| Vincular telefone a empresa | `linkPhoneToCompany` | `contact_link / contact_linked_company` |
| Criar sub-cliente | `createSubClientWithParentCompany` | `subclient_created` |
| CRM contato criar/editar/excluir | server fns de CRM | `crm_contact_*` |
| Ticket criar / finalizar / transferir | server fns de tickets locais | `ticket_*` |
| Tarefas criar / atribuir / concluir | server fns de tasks | `task_*` |
| OKR objetivo / KR / check-in | server fns de OKR | `okr_*`, `kr_*` |

A chamada do log fica no fim do handler bem-sucedido, em `try/catch` próprio para nunca quebrar a operação principal.

### 4. UI — `src/routes/configuracoes.auditoria.tsx`

- Acesso bloqueado a quem não for `admin`/`gestor` (mostra "Sem permissão").
- Cabeçalho com título e botão **Exportar CSV**.
- Barra de filtros:
  - Período (atalhos hoje / 7d / 30d / custom com date range)
  - Categoria (multi-select: Login/Logoff, Presença, Vinculação, CRM, Atendimentos, Tarefas, OKR)
  - Operador (select de profiles)
  - Busca livre (por target_label / metadata)
- Tabela com colunas: Data/Hora · Operador · Categoria (badge colorido) · Evento · Alvo · Detalhes (botão "Ver" abre dialog com JSON formatado).
- Paginação infinita (TanStack Query `useInfiniteQuery`, 50 por página).

### 5. Sidebar

Adicionar item em `app-sidebar.tsx`:
`{ title: "Auditoria", url: "/configuracoes/auditoria", icon: ShieldCheck }` — visível somente quando `hasRole('admin') || hasRole('gestor')`.

### 6. Detalhes técnicos

- Toda gravação passa por server function com `supabaseAdmin` para garantir que o registro não dependa de RLS do usuário e seja imutável.
- IP e User-Agent capturados a partir de `request.headers` dentro das server fns (`x-forwarded-for`, `user-agent`).
- `metadata` segue um shape pequeno e tipado por evento (documentado em comentário no arquivo `audit.functions.ts`).
- Sem mudanças em tabelas existentes.

### Arquivos

**Criar:** `src/lib/audit.functions.ts`, `src/routes/configuracoes.auditoria.tsx`, `src/components/auditoria/audit-filters.tsx`, `src/components/auditoria/audit-table.tsx`, `src/components/auditoria/audit-detail-dialog.tsx`.

**Editar:** `src/components/app-sidebar.tsx`, `src/hooks/use-auth.tsx` (login/logout), `src/components/chat-availability-toggle.tsx` (presença), e as server fns existentes de CRM / vinculação / tickets / tasks / OKR para chamarem `logAuditEvent`.

**Migration:** criação da tabela `audit_logs`, índices e policies de SELECT.
