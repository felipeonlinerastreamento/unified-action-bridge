# Sempre abrir novo protocolo após finalização

## Comportamento atual (problema)

Em `src/routes/api.public.zapi-webhook.$channelId.tsx`, quando o chat está `finalizado` e o cliente envia nova mensagem, há uma janela de **1 hora**: se a nova mensagem chega ≤ 1h após `closed_at`, o sistema **reabre o mesmo chamado** (status `reaberto`, mantém o protocolo, marca `justReopenedSilently = true` e **não roda o bot**). Foi isso que causou os casos #01352, #01363 e #01351 — em vez de abrir um protocolo novo, o anterior foi reaberto sem fluxo de atendimento.

## Mudança

Remover a janela de 1h. Toda mensagem de cliente em chat finalizado deve:

1. Criar um **novo `service_ticket`** (protocolo novo).
2. **Não setar** `justReopenedSilently` → o bot roda normalmente, reapresenta o menu/saudação, e o chat segue o fluxo padrão de fila/atribuição.
3. Manter `baseUpdate.bot_state = {}` e a atribuição já calculada (`reopenAssignedTo` / `aguardando`).

O ramo **pending_resolve** (`aguardando_retorno`, "A resolver") **NÃO é alterado** — ali a regra de manter o mesmo protocolo é intencional (operador marcou para retorno).

## Edits

Arquivo único: `src/routes/api.public.zapi-webhook.$channelId.tsx`, bloco do `else` em ~linhas 855–917.

- Apagar o `if (withinOneHour && lastTicket) { ... reaberto ... justReopenedSilently = true } else { ... new ticket ... }`.
- Manter apenas o caminho "novo ticket": insert em `service_tickets` com `status: 'aberto'`, `notes` referenciando o protocolo anterior quando existir.
- Remover variáveis não mais usadas no escopo (`ONE_HOUR_MS`, `withinOneHour`).

## Fora de escopo

- Sem mudanças de schema.
- Sem mudanças no fluxo `aguardando_retorno`.
- Sem alterações no bot, na Central, ou em CSAT.
