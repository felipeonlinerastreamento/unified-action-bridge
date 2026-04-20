

# Configuração de Rastreio Sedex no menu "Encaminhamento por Categoria"

## Objetivo

Adicionar à página **Configurações → Encaminhamento por Categoria** uma área de administração específica para regras com a categoria **"Correios Controle de Movimentações"**, permitindo gerenciar o comportamento do rastreio Sedex (intervalo de atualização, notificações, validações) sem precisar mexer em código.

## O que será feito

### 1. Nova tabela `tracking_settings` (singleton de configuração global)

Campos:
- `id` (uuid, PK)
- `auto_refresh_enabled` (bool, default true) — liga/desliga o cron horário
- `refresh_interval_minutes` (int, default 60) — frequência de atualização automática
- `notify_on_delivered` (bool, default true) — gera notificação quando entregue
- `notify_on_exception` (bool, default true) — notifica em falhas/devolução/ausência
- `notify_sector_members` (bool, default true) — notifica todos do setor
- `notify_assigned_only` (bool, default false) — só o responsável
- `auto_close_ticket_on_delivery` (bool, default false) — fecha ticket ao entregar
- `require_tracking_code` (bool, default true) — torna obrigatório no momento da criação
- `tracking_code_pattern` (text, default `^[A-Z]{2}\d{9}[A-Z]{2}$`) — regex de validação
- `whatsapp_notify_client` (bool, default false) — placeholder para futura integração
- `updated_at`, `updated_by`

RLS: admin/gestor gerenciam, autenticados leem.

### 2. Nova seção visual em `configuracoes.encaminhamento.tsx`

Quando o usuário cadastrar/editar uma regra cuja `category_label` contenha "Correios" (ou tiver flag específica), aparece automaticamente um **bloco expandido "Configuração de Rastreio Sedex"** abaixo do formulário com os campos acima.

Além disso, no topo da página será adicionado um card dedicado **"Rastreamento Sedex"** (visível independente das regras), com:
- Switch geral "Ativar atualização automática"
- Select de intervalo (15min / 30min / 1h / 2h / 6h)
- Switches de notificação (entregue / exceção / setor inteiro / só responsável)
- Switch "Exigir código no cadastro"
- Switch "Fechar ticket automaticamente ao entregar"
- Botão **"Atualizar todos agora"** (admin/gestor) — chama `/hooks/refresh-tracking`
- Botão **"Testar código"** — input + chama `previewTracking` e mostra resultado
- Métricas rápidas: total em trânsito, entregues hoje, com erro

### 3. Aplicar as configurações no fluxo existente

- `tracking.server.ts` `refreshAllPending`: lê `tracking_settings` e respeita `auto_refresh_enabled`; ajusta filtro de quem notificar.
- `tracking.server.ts` `notifyTicketSector`: respeita `notify_sector_members` vs `notify_assigned_only`, e só dispara se `notify_on_delivered`.
- `refreshOneTracking`: se `auto_close_ticket_on_delivery` e entregue → atualiza `service_tickets.status='resolvido'` + `closed_at`.
- `ticket-create-dialog.tsx`: quando categoria for de Correios, lê `require_tracking_code` e `tracking_code_pattern` para validar.
- Cron horário existente continuará rodando, mas a função sairá imediatamente se `auto_refresh_enabled = false`.

### 4. Permissões / segurança

- Só admin/gestor podem alterar `tracking_settings` e disparar refresh manual global.
- Atendentes só visualizam.

## Fora de escopo

- Mudar a UI de criação de tickets (já feita em iteração anterior).
- Integração WhatsApp para avisar cliente — fica como switch desabilitado/placeholder.
- Múltiplas transportadoras (continua só Correios/SeuRastreio).

## Detalhes técnicos

- Migration cria a tabela `tracking_settings` + insere 1 linha default.
- Hook `useTrackingSettings()` em `src/hooks/` para uso em UI e em `ticket-create-dialog`.
- Botão "Atualizar todos" usa `fetch('/hooks/refresh-tracking', { method:'POST', headers:{ Authorization:'Bearer '+token } })`.
- Layout: dois Cards na página `configuracoes.encaminhamento.tsx`, posicionados entre o header e o card "Regras de Encaminhamento" — assim a configuração do Correios fica em destaque.

