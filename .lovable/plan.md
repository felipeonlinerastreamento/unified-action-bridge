## Problema

Tickets da categoria **Teste de Equipamento** (ex.: #01606, #01616, #01628) estão sendo finalizados em vez de irem para o setor Administrativo como "aberto".

Causa: em `src/lib/ticket-finalize-flow.ts`, a etapa 1 do fluxo (Teste de Equipamento) foi removida e ficou apenas um comentário ("regra foi removida"). Como não existe `category_routing_rules` cadastrada para essa categoria, o ticket cai direto no "Standard finalize". As configurações em `teste_equipamento_settings` continuam ativas (`is_enabled=true`, target `Administrativo` / `aberto`, `auto_sync_gsystem=false`), só não são lidas.

## Correção

Reintroduzir o bloco de roteamento Teste de Equipamento em `finalizeTicketWithFlow`, antes da checagem de `category_routing_rules`.

### Comportamento

Quando todos os seguintes forem verdade:
- `bypassRouting` é falso (admin não está pulando o fluxo)
- existe registro em `teste_equipamento_settings` com `is_enabled = true`
- `isTesteEquipamentoCategory(ticket.category, settings)` retorna true (já existe no hook)
- o setor atual do ticket (relido do banco) ainda não é o `target_sector_name` da config (evita reencaminhar quando o atendente do Administrativo clicar em Finalizar de novo)

Então:
1. `UPDATE service_tickets` → `status = settings.target_status` (ex.: `aberto`), `sector = settings.target_sector_name`, `assigned_to = null`, `closed_at = null`, `updated_at = now()`.
2. `INSERT` em `ticket_assignments` (`ticket_id`, `assigned_by = userId`, `sector_name = target`).
3. Comentário do sistema (`comment_type = 'encaminhamento'`): "Atendimento finalizado e encaminhado automaticamente para o setor \"Administrativo\" (fluxo Teste de Equipamento)."
4. Se `settings.auto_sync_gsystem = true` **e** ainda não existe `entity_links` com `entity_type='pendencia'` para o ticket, chama `syncTicketToGsystem({ data: { ticketId } })` e registra comentário. (Hoje a config está desligada, então esse passo fica inerte.)
5. Chama `closeLinkedZapiChat(ticket.attendance_id)` (mesma função usada hoje).
6. Retorna `{ routed: true, routedTo: { sector, status }, syncedToGsystem, pendenciaKey, syncError }`.

Quando o ticket já está no setor destino (atendente do Administrativo clicou Finalizar), o bloco é ignorado e o fluxo segue: cai em `category_routing_rules` (não há regra) e depois no Standard finalize, encerrando o ticket de verdade.

### Carregamento das settings

Hoje `teSettings` é opcional no input. Para garantir que o roteamento funcione mesmo quando o caller (kanban drag-drop, central, painel) não passa as settings, fazer fetch tardio dentro de `finalizeTicketWithFlow` quando `teSettings` for `undefined`:

```ts
let settings = teSettings ?? null;
if (settings === undefined) {
  const { data } = await supabase
    .from("teste_equipamento_settings")
    .select("*")
    .limit(1)
    .maybeSingle();
  settings = data as TesteEquipamentoSettings | null;
}
```

(Usa `as any` se o tipo gerado ainda não inclui a tabela, mesmo padrão já usado no hook.)

### Não fazer

- Backfill: a pedido do usuário, não reabrir os tickets #01606/#01616/#01628 já finalizados — apenas corrigir o fluxo daqui pra frente.
- Não alterar `auto_sync_gsystem` (mantém desligado).
- Não tocar em UI, settings ou em `ticket-finalize.functions.ts`.

## Arquivo alterado

- `src/lib/ticket-finalize-flow.ts` — adicionar bloco "1. Teste de Equipamento" entre o bypass admin e a checagem de `category_routing_rules`.

## Verificação

1. Build/typecheck verde.
2. Finalizar um ticket da categoria "Teste de Equipamento" pelo painel → deve virar `status=aberto`, `sector=Administrativo`, `assigned_to=null`, com comentário de encaminhamento.
3. Em seguida, no setor Administrativo, clicar Finalizar de novo → cai no Standard finalize (`status=finalizado`, `closed_at` preenchido).
