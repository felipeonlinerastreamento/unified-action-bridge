## Objetivo

Quando o cliente enviar mensagem em um chat marcado com a tag **"Osvaldo Btec"** e esse chat estiver sem operador atribuído, o sistema deve automaticamente atribuir o chat ao operador do setor **Atendimento** que estiver com a menor fila (mesma regra já usada em outros pontos via `pick_least_loaded_agent`).

## Como funcionará

1. No webhook do WhatsApp (`src/routes/api.public.zapi-webhook.$channelId.tsx`), após registrar a mensagem inbound (`fromMe = false`) e atualizar o `zapi_chats`, executar uma checagem extra:
   - Se o chat tiver a tag `"Osvaldo Btec"` no campo `tags` **e**
   - `assigned_to` estiver `null` **e**
   - `status` não for `finalizado` nem `bot`
   - então chamar `supabase.rpc('pick_least_loaded_agent', { _sector: 'Atendimento' })`.
2. Se o RPC retornar um operador, atualizar o chat:
   - `assigned_to = <user_id>`
   - `sector_name = 'Atendimento'`
   - `status = 'em_atendimento'`
3. Se o RPC retornar `null` (ninguém disponível/online), fazer fallback para `pick_least_loaded_agent_any` (mesma estratégia já usada no código). Se ainda assim nada vier, deixar como está (chat permanece em "aguardando" para um operador puxar manualmente).
4. Registrar um evento em `attendance_event_logs` (`event_type: 'auto_assigned_by_tag'`) para auditoria.

## Onde se aplica e onde NÃO se aplica

- **Aplica** apenas no fluxo de mensagem inbound do cliente (mesmo bloco onde já tratamos `shouldReopen`/`baseUpdate` no webhook).
- **Não** reatribui se o chat já tiver `assigned_to`.
- **Não** afeta chats sem a tag "Osvaldo Btec".
- **Não** mexe em tickets (`service_tickets`) — a regra é só do chat na Central de Atendimento.

## Como marcar o chat com a tag

A regra usa o campo `tags` (jsonb array) já existente em `zapi_chats`. O contato "Osvaldo Btec" hoje aparece com `tags = []`. Para a regra disparar, é preciso adicionar a tag `"Osvaldo Btec"` ao chat — isso pode ser feito pelo componente `chat-tags.tsx` (UI já existe). Se preferir que eu deixe a tag aplicada de antemão para o chat existente, posso incluir um update pontual após a alteração.

## Arquivos alterados

- `src/routes/api.public.zapi-webhook.$channelId.tsx` — adicionar a checagem da tag + chamada ao `pick_least_loaded_agent` logo após o `update` do `baseUpdate` para mensagens inbound.

## Fora do escopo

- Configurar a regra por UI (lista de tags → setor). Se quiser uma versão genérica para várias tags/categorias no futuro, dá pra evoluir criando uma tabela tipo `tag_auto_assign_rules`.
- Reatribuição contínua a cada resposta (você já optou por "só quando estiver sem operador").
