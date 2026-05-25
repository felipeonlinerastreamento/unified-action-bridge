## Roteamento por setor do operador no finalize

**Objetivo**: quando o ticket for finalizado e a regra de categoria existir mas **não definir setor destino** (ou não houver regra), encaminhar o ticket para o setor do operador que está finalizando, em vez de cair no finalize padrão. Adicionalmente, manter o chat Z-API vinculado atribuído ao próprio operador (status `em_atendimento`).

### Arquivo a editar
- `src/lib/ticket-finalize-flow.ts`

### Mudanças

1. **Novo helper** `resolveOperatorSector(userId, currentSector)`:
   - Busca em `user_sector_assignments` JOIN `sectors` (apenas `is_active = true`) os setores do operador.
   - Se `currentSector` estiver entre eles → retorna `currentSector`.
   - Senão → retorna o primeiro (ordem alfabética).
   - Se o operador não tem setor algum → retorna `null` (cai no finalize padrão).

2. **Bloco "Standard finalize" (linha 345)** vira condicional:
   - Antes de fazer o `update status=finalizado`, chamar `resolveOperatorSector(userId, ticket.sector)`.
   - Se retornar um setor diferente do atual:
     - `UPDATE service_tickets SET status='aberto', sector=<setor_op>, assigned_to=userId, closed_at=null, updated_at=now()`.
     - `INSERT ticket_assignments (ticket_id, assigned_by=userId, sector_name=<setor_op>)`.
     - `insertSystemComment(..., "Atendimento finalizado e encaminhado para o setor \"X\" (setor do operador).", "encaminhamento")`.
     - Para o chat Z-API vinculado: em vez de `closeLinkedZapiChat`, fazer `UPDATE zapi_chats SET status='em_atendimento', assigned_to=userId, sector_name=<setor_op>, closed_at=null, pending_resolve_at=null, pending_resolve_ticket_id=null, pending_resolve_user_id=null WHERE id=attendance_id` (novo helper `assignChatToOperator`).
     - Retornar `{ routed: true, routedTo: { sector, status: 'aberto' } }`.
   - Se o setor do operador já é o setor atual do ticket, ou operador não tem setor → segue o fluxo padrão atual (finaliza + `closeLinkedZapiChat`).

3. **Bloco "category_routing_rules" (linha 226)**:
   - Comportamento atual permanece quando `rule.target_sector_name` está definido.
   - Quando há `rule` mas **sem** `target_sector_name`, não retornar — deixar fluir para o passo 3 (que agora aplicará o setor do operador).
   - Hoje a query já trata isso (a condição `rule && rule.target_sector_name` evita o roteamento), então nenhuma mudança extra é necessária além de garantir que `pendenciaAlreadyExists`/sync continuem rodando só dentro do `if`.

### Fora de escopo
- Alterar regras de categoria existentes ou criar UI.
- Mexer no fluxo `bypassRouting` (admin), Teste de Equipamento, ou pendências GSystem.
- Backfill de tickets já finalizados (ex.: #01644).
- Alterar o setor do chat quando o ticket roteia via regra de categoria (já funciona).
