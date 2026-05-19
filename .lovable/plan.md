# Garantir que Teste de Equipamento sempre vire "aberto" no Administrativo

## Causa raiz

Em `src/lib/ticket-finalize-flow.ts` (branch TE, ~linhas 130–185) há um atalho `alreadyRoutedTE`:

```ts
const alreadyRoutedTE =
  normalizeFlowText(liveSectorTE) === normalizeFlowText(targetSector) || hasPreviousTERoute;
if (alreadyRoutedTE) {
  // grava status = "finalizado" e closed_at = now()  ❌
}
```

Quando o ticket **já chega** com `sector = "Administrativo"` (alguns são criados assim por automação de categoria antes do operador clicar "Finalizar"), esse atalho dispara e o protocolo é **finalizado** em vez de permanecer **aberto** no Administrativo.

Confirmado em produção: tickets recentes da categoria Teste de Equipamento (#1330, #1336, e outros) terminam com `status=finalizado` no `Administrativo` **sem nenhum `ticket_assignments`/encaminhamento** — exatamente o caminho do atalho. O ticket #1349 chegou a entrar no fluxo (encaminhamento gravado), mas depois o operador clicou Finalizar de novo, caiu no mesmo atalho e foi finalizado 48s depois.

## Regra correta (do usuário)

> Todo chamado da categoria "Teste de Equipamento" finalizado no chat **mantém o mesmo protocolo**, transferido para o setor **Administrativo** com status **aberto**.

Ou seja: finalizar o chat ≠ finalizar o ticket. O ticket TE deve sempre terminar `status=aberto`, `sector=Administrativo`, `closed_at=null`, sem operador atribuído — independentemente do estado anterior.

## Mudança

Arquivo único: `src/lib/ticket-finalize-flow.ts`, somente o ramo TE.

1. **Remover o atalho `alreadyRoutedTE` que finaliza o ticket.** O ticket TE nunca é finalizado por este fluxo.
2. **Tornar o update idempotente** — sempre escreve:
   - `status: targetStatus` (padrão `aberto`)
   - `sector: targetSector` (padrão `Administrativo`)
   - `assigned_to: null`
   - `closed_at: null`, `closed_by: null`
   - `updated_at: now()`
3. **Evitar ruído em re-clicks de Finalizar:** se já houver `ticket_assignments` para o `targetSector` ou comentário `encaminhamento` mencionando o setor, **não** insere nova linha em `ticket_assignments` nem novo comentário "Atendimento finalizado e encaminhado…". Idem para o sync GSystem: só roda se `pendencia_key` ainda não estiver setado (já existe lookup de `pendencia_key` no fluxo).
4. **`closeLinkedZapiChat(ticket.attendance_id)` continua sendo chamado** ao final (o chat fecha; o ticket fica aberto).

Resultado:
- 1º clique em Finalizar: roteia para Administrativo (status aberto), grava 1 `ticket_assignments`, 1 comentário de encaminhamento, sync GSystem (se habilitado), fecha o chat.
- 2º clique (se acontecer): apenas re-aplica os mesmos campos no ticket e fecha o chat de novo — sem duplicar comentários e sem mudar o ticket para `finalizado`.

## Fora de escopo

- Não mexer no ramo `category_routing_rules` (`useRoutingRules`) — só o ramo TE.
- Não alterar `teste_equipamento_settings` no banco.
- Não mexer no `central.tsx` (a chamada `finalizeTicketWithFlow` já passa os args certos).
- Não alterar o webhook (`api.public.zapi-webhook.*`).
