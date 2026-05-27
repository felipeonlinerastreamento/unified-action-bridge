## Objetivo
Quando uma conversa entra na Central, fica como "aguardando" até o cliente digitar o setor. Se em 10 minutos o setor não for escolhido, o sistema deve atribuir automaticamente a conversa a um operador do setor **Atendimento** com a menor fila de chamados ativos.

## Como vai funcionar
- Um job em segundo plano roda a cada minuto e procura chats com:
  - `status = 'aguardando'`
  - sem `assigned_to` definido
  - sem `sector_name` definido (cliente ainda não escolheu setor)
  - `created_at` (ou `last_message_at`) mais antigo que 10 minutos
- Para cada chat encontrado:
  1. Define `sector_name = 'Atendimento'`
  2. Escolhe o operador do setor Atendimento com menor número de chats `em_atendimento` (usa a função `pick_least_loaded_agent_any` que já existe e ignora disponibilidade, conforme escolhido).
  3. Atribui o chat (`assigned_to`, `status = 'em_atendimento'`).
  4. Registra um evento em `attendance_event_logs` (`event_type: 'auto_route_aguardando'`) para auditoria.
- Se nenhum operador existir no setor Atendimento, o chat permanece aguardando e o scanner tenta novamente no próximo ciclo.

## Mudanças técnicas
1. **Novo server route**: `src/routes/api.public.auto-route-aguardando.tsx`
   - `POST` protegido por `isAuthorizedCronRequest` (mesmo padrão de `api.public.chat-idle-scanner.tsx`).
   - Lê chats elegíveis, chama `pick_least_loaded_agent_any('Atendimento')` via `supabaseAdmin.rpc`, atualiza o chat e registra log.

2. **Cron job (pg_cron)** via `supabase--insert`:
   - Schedule: a cada 1 minuto.
   - Chama o endpoint acima com header `apikey` (anon key) — sem novos secrets.

## Fora de escopo
- UI de configuração (timeout e setor ficam fixos: 10 min, "Atendimento").
- Notificação push ao operador atribuído (usa o fluxo padrão já existente de novo chat atribuído).
- Alteração das regras já existentes de roteamento por palavra-chave (`message_triggers`) ou de ociosidade (`chat-idle-scanner`).
