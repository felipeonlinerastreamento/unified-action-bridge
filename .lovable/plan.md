## Problema

Quando o chat `5531994730315` recebeu uma nova mensagem, ele foi reaberto direto na fila do "Administrativo" e atribuído a um operador, sem passar pelo bot.

Causa: em `src/routes/api.public.zapi-webhook.$channelId.tsx` (linhas 821-883), a lógica de reabertura **preserva o `sector_name` antigo** do chat (ou do último ticket) e pré-atribui um agente, pulando o bot:

```ts
reopenSector = existing.sector_name || lastTicket?.sector || "Atendimento";
reopenAssignedTo = await pickLeastLoadedAgent(reopenSector);
baseUpdate.status = reopenAssignedTo ? "em_atendimento" : "aguardando";
```

Como o chat tinha `sector_name = "Administrativo"` (provavelmente de uma transferência manual antiga), toda reabertura caía lá, mesmo com o menu do bot oferecendo só Atendente / Comercial / Financeiro.

## Regra acordada

- **Toda nova mensagem** (chat novo ou reabertura de finalizado / aguardando_retorno) deve passar pelo **bot primeiro**.
- Quando o cliente escolhe "Atendente" (ou cai no fallback do fluxo), o roteamento vai para o **menos carregado online do setor "Atendimento"**.
- Se ninguém estiver online em "Atendimento", o chat fica em `aguardando` (não tenta outro setor).

## Mudanças

### 1. `src/routes/api.public.zapi-webhook.$channelId.tsx` — bloco de reabertura

Remover o pré-roteamento por setor antigo. Tanto no ramo `isPendingResolve` quanto no ramo "finalizado normal":

- Limpar `sector_name` e `assigned_to` (passam a `null`).
- Setar `status = "bot"` e `bot_state = {}` para o fluxo de boas-vindas rodar de novo desde o início.
- Manter o resto (preview, unread_count, contact_name, limpeza dos campos `pending_resolve_*` quando aplicável).
- Remover as chamadas a `pickLeastLoadedAgent(reopenSector)` desse bloco — o roteamento vai acontecer dentro do bot quando o cliente escolher uma opção (nó `route_to_least_loaded` com `target_sector: "Atendimento"`, que já existe no fluxo).
- Remover `justReopenedSilently = true` no ramo pending_resolve, para o bot voltar a aparecer.

### 2. Garantir que o fluxo do bot tenha "Atendimento" como destino

Verificar em `zapi_bot_flows.nodes` que a opção "Falar com um Atendente" usa `type: "route_to_least_loaded"` com `target_sector: "Atendimento"`. Se já estiver assim (esperado, dada a função `pick_least_loaded_agent`), nada a fazer; caso contrário, ajustar via migração no JSON do fluxo ativo do canal.

### 3. Correção pontual do chat afetado

Resetar a linha do chat `f663ac2a-f949-4807-8f76-3660dcd45384` (`5531994730315`) para que a próxima mensagem dele caia na regra nova: limpar `sector_name` e `assigned_to`, setar `status = 'aguardando'` (já tem assigned hoje; pode finalizar fluxo atual ou só limpar — confirmar com o usuário se deve mexer no chat ao vivo ou só corrigir daqui pra frente).

## Fora do escopo

- Não mexer em chats em andamento de outros setores (Comercial / Financeiro) que estejam ativos — a regra só se aplica quando uma mensagem nova entra num chat novo ou já finalizado.
- Não alterar o comportamento de transferência manual (operador transferindo para outro setor pelo painel).
- Sem mudanças em RLS / segurança.
