## Problema

Hoje, ao finalizar um chat de categoria **Teste de Equipamento** na Central:

- Status **"Resolvido"** → roda `finalizeTicketWithFlow`, e o branch TE já reabre o ticket em Administrativo. OK.
- Status **"A resolver"** → o código **pula** `finalizeTicketWithFlow` (linha 2071: `if (ticketRef && !result?.pendingResolve)`), então o ticket TE **não é roteado** para o setor configurado e o chat não é fechado pelo fluxo. **Esse é o bug.**

Além disso, quando o status é "Resolvido" e existe `pendencia_key`, o código chama `concluirPendencia` no GSystem (linha 1708) — o que conflita com a regra "ticket deve continuar aberto". Para TE, a pendência precisa permanecer aberta também.

## Regra alvo (confirmada com o usuário)

Para a categoria **Teste de Equipamento**, ao finalizar o chat — **com qualquer status** (Resolvido ou A resolver):

1. Ticket local fica **`status = aberto`** no setor configurado em `teste_equipamento_settings.target_sector_name` (hoje "Administrativo"), `assigned_to = null`, `closed_at = null`.
2. Chat na Central é fechado normalmente (`zapi_chats.status = 'finalizado'`).
3. Pendência no GSystem **não** é concluída (segue aberta junto com o ticket).
4. Demais categorias seguem o comportamento atual sem mudança.

## Alterações

### 1. `src/routes/central.tsx` — rodar o fluxo TE também em "A resolver"

Por volta da linha 2071, trocar a guarda:

```ts
if (ticketRef && !result?.pendingResolve) { ... }
```

por algo como:

```ts
const isTEFinalize = isTesteEquipamentoCategory(ticketRef?.category, teSettings);
if (ticketRef && (!result?.pendingResolve || isTEFinalize)) {
  // ...finalizeTicketWithFlow como hoje
}
```

Importar `isTesteEquipamentoCategory` de `@/hooks/use-teste-equipamento-settings` (já usado no arquivo se necessário, senão adicionar import).

Como `finalizeTicketWithFlow` no branch TE já força `status: targetStatus` (default `aberto`), `closed_at: null` e roda `closeLinkedZapiChat`, isso cobre tanto "Resolvido" quanto "A resolver".

### 2. `src/routes/central.tsx` — não concluir pendência GSystem quando TE

No bloco da linha 1707-1722 (`if (pendenciaKey && status === "Resolvido")`), acrescentar guarda:

```ts
const isTEActive = isTesteEquipamentoCategory(
  resolvedCategoryLabel || activeTicket.category,
  teSettings
);
if (pendenciaKey && status === "Resolvido" && !isTEActive) {
  // concluirPendencia como hoje
}
```

Assim a pendência GSystem segue aberta para TE, em consistência com o ticket local.

### 3. Nada muda em `src/lib/ticket-finalize-flow.ts`

O branch TE já está correto (idempotente, força aberto no setor alvo, fecha chat). Não precisa tocar.

### 4. Nada muda nas demais categorias

A guarda `pendingResolve` segue valendo para categorias normais — "A resolver" continua mantendo o ticket aberto sem disparar encaminhamento automático para elas.

## Fora de escopo

- Configuração do setor alvo (`teste_equipamento_settings.target_sector_name`) — segue sendo o configurado em Configurações → Fluxo Teste de Equipamento. Se o usuário quiser que seja literalmente um setor chamado "Atendimento", basta ajustar nessa tela; não é mudança de código.
- Webhook de nova mensagem, regras de outras categorias, kanban e detail panel.
