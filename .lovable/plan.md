## Problema

Atendimentos finalizados (ex.: Daiana Cofermon) continuam aparecendo na tela da Central. Verifiquei no banco:

- `zapi_chats` de Daiana: `status = em_atendimento`, `assigned_to = operadora`, `sector_name = Administrativo` — ou seja, o chat foi **reaberto** logo após a finalização.
- Não existe regra em `category_routing_rules` para "Assuntos Financeiros" e não é fluxo de Teste de Equipamento.

## Causa raiz

No fluxo de pós-finalização (`src/lib/ticket-finalize-flow.ts`, seção "3. Operator-sector routing", linhas 418–455) existe uma regra que diz:

> Se o operador que finalizou pertence a algum setor diferente do setor atual do ticket, o ticket é **reaberto** naquele setor e o chat é **reatribuído** ao operador via `assignChatToOperator` (que volta o `zapi_chats` para `em_atendimento`).

Para a Daiana:
1. Operadora finalizou com categoria "Assuntos Financeiros".
2. `mutationFn` criou o ticket como `finalizado` (sector = null) e marcou o `zapi_chats` como `finalizado`.
3. `onSuccess` chamou `finalizeTicketWithFlow`. Como não há regra de categoria, caiu na seção 3 (operator-sector): operadora pertence a "Administrativo" → setor atual ("") ≠ "Administrativo" → reabriu o ticket como `aberto/Administrativo` e **reatribuiu o chat à operadora como `em_atendimento`**.

Por isso o chat nunca sai da tela: toda finalização de um operador com setor configurado dispara essa reatribuição.

## Mudança proposta

Remover o auto-roteamento "pro setor do operador" do `finalizeTicketWithFlow`. Quando não há fluxo de Teste de Equipamento nem regra de categoria configurada, a finalização deve ser **finalização padrão** (status `finalizado`, `closed_at = now`, `closeLinkedZapiChat`) e o chat deve sair da Central.

### Arquivo: `src/lib/ticket-finalize-flow.ts`

1. **Remover a seção "3. Operator-sector routing"** (todo o bloco que chama `resolveOperatorSector` + `assignChatToOperator`). Cair direto para a finalização padrão (seção 4).
2. **Remover as funções auxiliares** que ficam órfãs: `resolveOperatorSector` e `assignChatToOperator`.
3. Manter intactos: TE flow (seção 1), category routing rules (seção 2), bypassRouting (admin) e finalize padrão (seção 4).

Resultado:
- Teste de Equipamento → continua roteando para o setor configurado (mantém chat aberto lá).
- Regra de categoria ativa → continua roteando para o setor da regra (mantém chat aberto lá).
- Sem regra de categoria → ticket vira `finalizado` e `zapi_chats` vira `finalizado`. **O chat sai da Central.**

### Backfill manual para o chat da Daiana

Migration que zera o estado do `zapi_chats` da Daiana para que ela saia da tela agora:

```sql
UPDATE public.zapi_chats
SET status = 'finalizado',
    assigned_to = NULL,
    closed_at = now()
WHERE id = '49756321-7941-4bb0-8d94-c2125e1cb7cc'
  AND status <> 'finalizado';
```

(O ticket atual `e7da39d6...` em "Administrativo / Assuntos Financeiros / aberto" continua existindo no menu Atendimentos, como esperado — só o chat sai da Central.)

## Validação

1. Finalizar um chat com uma categoria sem regra de roteamento → o chat **some** da lista da Central imediatamente.
2. Finalizar um chat com categoria "Teste de Equipamento" → continua indo para o setor configurado (Administrativo, A resolver) e o chat sai da Central (fluxo TE existente).
3. Finalizar um chat com categoria que tem `category_routing_rules` ativa → roteamento da regra continua funcionando.
4. Confirmar via `zapi_chats` que o registro fica com `status = finalizado` e some de `listAllOpenChats`.
