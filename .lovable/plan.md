## Diagnóstico

Verifiquei o chat referente ao protocolo **#02897** (telefone 5527999175043, id `70f33d43…`):

- `status = "bot"` (preso no nó `welcome` do fluxo do bot)
- `assigned_to = null`, `sector_name = null`
- Última mensagem: 25/06 12:59 — ou seja, o cliente respondeu, mas o bot não avançou e o chat **nunca entrou em `aguardando`**.

A rotina que distribui automaticamente para operadores (`/api/public/auto-route-aguardando`) só processa chats com **`status = 'aguardando'`** e `sector_name IS NULL` parados há ≥10 min. Como esse chat ficou em `status = 'bot'`, ele nunca foi considerado para distribuição — por isso continuou sem operador apesar do tempo.

Não existe hoje nenhuma rotina que retire chats travados no bot e os encaminhe automaticamente.

## Proposta

Estender a rotina `api.public.auto-route-aguardando.tsx` para também tratar chats parados em `status = 'bot'`:

1. Após processar os `aguardando`, buscar `zapi_chats` com:
   - `status = 'bot'`
   - `assigned_to IS NULL`
   - `last_message_at < now() - INTERVAL '10 minutes'` (mesmo `IDLE_MINUTES` atual)
   - ignorar grupos (`@g.us` / sufixo `-group` / telefone > 15 dígitos), igual ao `chat-idle-scanner`.
2. Para cada um, chamar `pick_least_loaded_agent_any('Atendimento')` e, se houver operador:
   - `update` para `status = 'em_atendimento'`, `sector_name = 'Atendimento'`, `assigned_to = <agent>`, `bot_state = {}` (libera do bot).
   - Log em `attendance_event_logs` com `event_type = 'auto_route_bot_stuck'`.
3. Se não houver operador disponível: apenas mover o chat para `status = 'aguardando'` + `sector_name = 'Atendimento'` (assim a rotina existente passa a vê-lo) e logar `auto_route_bot_stuck_no_agent`.
4. Manter `limit(100)` por execução e o response JSON agregando os dois blocos (`aguardando` + `bot`).

## Detalhes técnicos

- Arquivo único alterado: `src/routes/api.public.auto-route-aguardando.tsx`.
- Sem migração — usa colunas e RPC já existentes (`pick_least_loaded_agent_any`, `attendance_event_logs`).
- A cron que já chama esse endpoint passa a cobrir os dois casos sem mudança de agendamento.
- O chat #02897 específico será capturado na próxima execução da rotina após o deploy.

## Pontos a confirmar

- Manter o limite de **10 minutos** também para chats em `bot`, ou usar um valor diferente (ex.: 15/20 min)?
- Quando não há operador online, prefere mover para `aguardando` (proposta acima) ou deixar em `bot` e só logar?
