

# Rastreamento de Sedex (Rastro.com.br) para tickets de Correios

## Visão geral

Adicionar suporte completo a rastreamento de envios para a categoria **"Correios controle de movimentações"**:

1. Campo **Código de Envio** aparece automaticamente quando essa categoria é selecionada (ao criar ou editar ticket)
2. Sistema consulta a API do **Rastro.com.br** periodicamente e armazena o histórico de eventos
3. Ao filtrar por categoria "Correios", a lista mostra o último status do Sedex em cada ticket
4. Quando o status muda para **"Entregue"**, todos os usuários do setor recebem uma notificação na plataforma

## Banco de dados

Nova tabela `ticket_tracking`:
- `id`, `ticket_id`, `tracking_code` (texto, único por ticket)
- `carrier` (default "correios"), `last_status`, `last_status_date`
- `is_delivered` (bool), `events` (jsonb com histórico completo)
- `last_checked_at`, `created_at`, `updated_at`

Nova tabela `notifications`:
- `id`, `user_id`, `ticket_id`, `type` (ex: `tracking_delivered`)
- `title`, `message`, `is_read` (bool), `created_at`
- RLS: usuário vê só suas próprias notificações; sistema pode inserir

Coluna nova em `service_tickets`:
- `tracking_code` (text, nullable) — guarda o código do envio diretamente no ticket para facilitar busca/filtro

Realtime ativado em `notifications` para alertas instantâneos.

## Integração com Rastro.com.br

A API do Rastro.com.br requer **token** (plano gratuito limitado, pago a partir de planos básicos). Preciso adicionar como secret `RASTRO_API_TOKEN` (e `RASTRO_USER` se aplicável) — vou solicitar quando começar a implementação.

**Server functions** (em `src/lib/tracking.functions.ts` + `src/lib/tracking.server.ts`):
- `trackPackage(code)` — consulta a API e devolve eventos normalizados
- `refreshTicketTracking(ticketId)` — atualiza um ticket específico
- `refreshAllPendingTracking()` — usado pelo cron, atualiza todos os códigos de tickets não entregues

**Cron job** via pg_cron + pg_net chamando rota `/hooks/refresh-tracking` a cada 1 hora (configurável). A rota:
1. Lê todos os `ticket_tracking` onde `is_delivered = false`
2. Consulta a API para cada código (com pequeno delay para respeitar rate limit)
3. Atualiza `events`, `last_status`, `last_status_date`
4. Quando detecta status "Entregue", marca `is_delivered = true` e dispara notificações para todos os usuários do setor do ticket

## Mudanças na interface

### `ticket-create-dialog.tsx`
- Quando `category === "Correios controle de movimentações"`, mostra campo extra **"Código de Envio (Sedex)"** (validação: formato BR de rastreio, ex: `AA123456789BR`)
- Salva o código em `service_tickets.tracking_code` e cria registro em `ticket_tracking`

### `ticket-detail-panel.tsx` (aba Detalhes)
- Nova seção **"Rastreamento Sedex"** quando o ticket tem `tracking_code`:
  - Status atual destacado (badge colorido: amarelo "Em trânsito", verde "Entregue", vermelho "Problema")
  - Data da última atualização
  - Lista expandível com histórico completo de eventos (data, local, descrição)
  - Botão **"Atualizar agora"** para refresh manual
  - Botão **"Editar código"** caso o atendente precise corrigir

### `ticket-list-view.tsx`
- Quando o filtro de categoria está em "Correios...", cada card mostra:
  - Badge com último status do Sedex
  - Local do último evento
  - Indicador visual se foi entregue (✓ verde)

### `ticket-filters.tsx`
- Novo filtro extra (só visível quando categoria = Correios): **Status do Envio** (Em trânsito / Entregue / Problema / Sem código)

### Notificações na plataforma
- Novo componente `<NotificationsBell />` no header (sino com badge de não-lidas)
- Dropdown com lista das últimas notificações
- Toast (sonner) automático quando chega notificação nova via Supabase Realtime
- Ao clicar na notificação, abre o ticket correspondente

## Sugestões adicionais para administração de envio de equipamentos

Como o objetivo principal é **gestão de envio de equipamentos**, sugiro também:

1. **Vincular item de estoque ao ticket de envio** — ao criar o ticket de Correios, escolher qual equipamento (do menu Estoque) está sendo enviado. Quando entregue, atualizar status do item para "entregue ao cliente".
2. **Comprovante de postagem** — upload de imagem/PDF do recibo dos Correios anexado ao ticket.
3. **Endereço de destino** — campos estruturados (CEP, rua, cidade, UF) integrados aos dados da empresa cliente; preenchimento automático via ViaCEP.
4. **Prazo estimado vs real** — mostrar SLA do envio (data prevista pela transportadora) e alertar se atrasou.
5. **Dashboard de envios** — KPIs específicos: total em trânsito, entregues no mês, atrasados, tempo médio de entrega por região.
6. **Notificação ao cliente** — opcionalmente enviar mensagem automática ao contato do ticket (via Central de Atendimento/WhatsApp) quando o pacote for entregue.
7. **Histórico de equipamentos por empresa** — ver todos os envios feitos para um cliente específico direto na tela Empresas.

Estas sugestões adicionais **não estão incluídas no plano principal** — me avise quais quer incluir agora ou depois.

## Detalhes técnicos

- **Migração SQL** cria as tabelas, índices, RLS, e ativa realtime em `notifications`
- **Cron** registrado via insert SQL (não migração) — precisa do anon key do projeto
- **Rate limiting** no server function: delay de 200ms entre chamadas no batch para não estourar limite da API
- **Fallback**: se a API falhar, registrar em `integration_logs` e não quebrar a UI
- **Secret `RASTRO_API_TOKEN`** será solicitado durante a implementação (vou pedir o valor)
- **Notificação para o setor**: query em `user_sector_assignments` cruzada com `sectors.name = ticket.sector` para descobrir destinatários

## O que NÃO muda

- Demais campos e fluxos do ticket continuam iguais
- Integração com GSystem (categorias) permanece como fonte da lista de categorias
- Outras categorias não mostram o campo de rastreio

