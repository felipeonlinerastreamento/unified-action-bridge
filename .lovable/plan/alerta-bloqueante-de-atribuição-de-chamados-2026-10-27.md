# Alerta bloqueante de atribuição de chamados

## O que muda para o usuário
- **Configurações > Notificações**: nova seção "Alertas de Atribuição de Chamados" com:
  - Ativar/desativar o alerta
  - Eventos: chamado criado para o atendente, chamado transferido/reatribuído, chamado vindo de e-mail
  - Som ligado/desligado
  - Abrangência: todos os atendentes ou só operadores escolhidos (ex.: Derick)
- **Tela do atendente**: quando um chamado é criado ou atribuído a ele, aparece um pop-up no meio da tela que **bloqueia qualquer tela do sistema** até clicar em "OK". Mostra protocolo, cliente, assunto e quem atribuiu ("Felipe atribuiu este chamado a você" ou "Atribuído automaticamente via e-mail"). Também há o botão "Abrir chamado" (que confirma o OK e abre o chamado). Se houver vários, aparecem um de cada vez. Se o atendente estiver deslogado, o pop-up aparece no próximo acesso.
- **Relatórios > Gatilhos**: cada alerta aparece com o tipo (Novo Chamado Manual, Chamado Atribuído, Entrada via E-mail), protocolo, cliente, atendente, quem gerou, hora do disparo, hora do OK e tempo até a ciência.

## Detalhes técnicos
- Migração:
  - Tabela `ticket_assignment_alert_settings` (linha única: enabled, eventos, som, scope `all|selected`, `user_ids uuid[]`) — leitura por autenticados, edição por Admin/Gestor via `has_role`.
  - Tabela `ticket_assignment_alerts` (ticket_id, target_user_id, event_type, triggered_by, triggered_by_name, protocol, client_name, subject, created_at, acknowledged_at) com GRANTs + RLS: atendente lê/atualiza apenas os seus; Admin/Gestor leem todos.
  - Gatilho `AFTER INSERT OR UPDATE OF assigned_to` em `service_tickets` (SECURITY DEFINER) que confere as configurações e insere o alerta; tipo `email` quando o chamado tem origem e-mail, `created` no insert, `reassigned` quando muda o responsável. Não alerta se o atendente atribuiu a si mesmo.
  - Realtime habilitado em `ticket_assignment_alerts`.
- Frontend:
  - `src/components/ticket-assignment-alert.tsx` montado no `app-layout`: busca alertas sem `acknowledged_at` do usuário, assina realtime, renderiza overlay fixo em tela cheia (z-index máximo, sem fechar por ESC/clique fora), toca som, grava `acknowledged_at` no OK.
  - Seção nova em `configuracoes.notificacoes.tsx`.
  - Aba Gatilhos em `relatorios.tsx` passa a incluir esses registros (filtro por tipo e coluna de tempo de ciência).
- Memória: atualizar `mem://features/email-tickets` / nova memória de alertas.
