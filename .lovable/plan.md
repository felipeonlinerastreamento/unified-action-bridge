

# Corrigir o fluxo "Teste de Equipamento"

## Diagnóstico

A infra do fluxo já existe (tabela `teste_equipamento_settings` populada com Administrativo/Aberto/auto-sync), os campos extras estão no diálogo e há card de gestão em **Configurações → Encaminhamento**. Mas o fluxo **não disparou** no único ticket existente da categoria porque:

1. **Kanban (drag-and-drop)** atualiza o status diretamente no banco sem chamar `updateStatus()` — então arrastar um card para "Finalizado" pula o auto-route, a sincronização GSystem e o registro do encaminhamento.
2. **Central de Atendimento** (chats WhatsApp) cria tickets sem oferecer os campos extras de Teste de Equipamento, e a finalização do chat também ignora o auto-route.
3. O `updateStatus()` do detail-panel **só** dispara o sync GSystem quando é Teste de Equipamento — outros tickets perdem o sync mesmo se a categoria tiver regra em `category_routing_rules`.
4. Faltam validações visuais no card de configuração (a tela "encaminhamento" mostra o card, mas não valida que `target_sector_name` exista realmente em `sectors`).

## Mudanças

### A. Centralizar a finalização (1 helper, 3 chamadas)

Criar `src/lib/ticket-finalize-flow.ts` com `finalizeTicketWithFlow({ ticket, userId, teSettings, routingRules })`:

- Detecta Teste de Equipamento (`isTesteEquipamentoCategory`) **ou** match em `category_routing_rules` ativo.
- Se houver match: faz `UPDATE service_tickets` para `status = target_status`, `sector = target_sector_name`, `assigned_to = null`, `closed_at = null`, registra comentário `encaminhamento` + cria linha em `ticket_assignments`.
- Se não houver match: finaliza normalmente (`status = finalizado`, `closed_at = now`).
- Se `auto_sync_gsystem` (TE) ou `auto_create_ticket` (rule): chama `syncTicketToGsystem({ ticketId })`, registra comentário sistema com `pendenciaKey` ou erro.

### B. Plugar o helper

- **`ticket-detail-panel.tsx`** → `updateStatus("finalizado")` passa a delegar para `finalizeTicketWithFlow`. Mantém o resto.
- **`ticket-kanban-view.tsx`** → `handleDrop` quando `newStatus === "finalizado"` chama `finalizeTicketWithFlow` em vez do `update` direto.
- **`src/routes/central.tsx`** → na ação "finalizar atendimento" do chat, depois de fechar o chat, se houver ticket vinculado (mesmo `attendance_id`), chama `finalizeTicketWithFlow`.

### C. Campos extras também no chat

- **`src/routes/central.tsx`** → quando o operador clica "Finalizar atendimento" e o ticket vinculado tem `category = Teste de Equipamento`, abrir um pequeno dialog reutilizando `<TesteEquipamentoFields />` antes de finalizar. Os dados são gravados em `notes` via `buildTesteEquipamentoNotes` e validados com `validateTesteEquipamento`.

### D. Garantia de descrição completa no GSystem

Atualizar `src/lib/ticket-finalize.functions.ts` (`syncTicketToGsystem`) para:

- Incluir explicitamente o bloco `[Teste de Equipamento]` (já vem no `notes`, ok).
- Adicionar `Setor destino`, `Origem (chat/manual)`, `Placa`, `Tracking`, **histórico completo de comentários** (já há) e **dados extras de TE parseados** (Subtipo, Necessário cobrar, Motivo, Garantia) em seção dedicada usando `parseTesteEquipamentoNotes`.
- Forçar `Tipo` da pendência = `"Atendimento"` (categoria genérica do GSystem) quando vier do fluxo TE, mantendo o subtipo na descrição. Hoje envia `"Teste de Equipamento"` que pode não existir no enum do GSystem e estourar erro silencioso.

### E. Melhorar o card de gestão (`teste-equipamento-config.tsx`)

- Trocar o `<Input>` livre de `target_sector_name` por `<Select>` populado com `sectors` ativos (mantém o valor atual mesmo se não estiver na lista, com aviso "setor inexistente").
- Mostrar badge "Ativo / Inativo" no header do card.
- Botão "Testar fluxo" que faz um dry-run: pega o último ticket TE em aberto e mostra o que seria gravado (sem persistir).

### F. Diagnóstico do ticket existente

O ticket `51ea3063…` está finalizado sem ter passado pelo fluxo. Adicionar botão **"Reprocessar fluxo"** no detail-panel (visível só em tickets TE finalizados sem `sector` preenchido) que chama `finalizeTicketWithFlow` re-executando o auto-route + sync.

## Arquivos tocados

```text
src/lib/ticket-finalize-flow.ts          (novo)
src/lib/ticket-finalize.functions.ts     (descrição enriquecida)
src/components/atendimentos/ticket-detail-panel.tsx
src/components/atendimentos/ticket-kanban-view.tsx
src/components/configuracoes/teste-equipamento-config.tsx
src/routes/central.tsx                   (dialog TE + finalize helper)
```

Sem migrações de banco — o schema já está pronto.

## Resultado esperado

- Operador finaliza ticket TE (de qualquer view: lista, kanban, central) → ticket vai para **Administrativo / Aberto** automaticamente, comentário de encaminhamento registrado, pendência criada no GSystem com descrição completa (dados do contato, placa, subtipo, motivo, garantia, histórico).
- Card de gestão na tela **Encaminhamento** permite ligar/desligar, escolher setor destino de uma lista válida, mudar status alvo e exigências de campos.
- Tickets antigos podem ser reprocessados manualmente sem reabrir.

