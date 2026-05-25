## Diagnóstico

Chamado **#01651** (`attendance_id = MANUAL-...`, criado pelo diálogo "Novo chamado") está com `opened_by`, `assigned_to` e `closed_by = NULL` no banco. Por isso o painel de detalhes mostra "—" no campo **"Criado por"** e a lista de chamados não exibe o badge do responsável.

A causa é `src/components/atendimentos/ticket-create-dialog.tsx` (linhas 344-359): no submit ele chama `supabase.auth.getUser()` para descobrir o id do criador. Quando essa chamada volta sem sessão (ex.: sessão recém-rotacionada, "lock stolen", offline curto), o insert vai ao banco com `opened_by: null` e `assigned_to: null` — e nunca mais é corrigido.

## Correção

1. **`src/components/atendimentos/ticket-create-dialog.tsx`**
   - Importar `useAuth` (`@/hooks/use-auth`) e usar `user.id` do contexto como fonte primária do criador (o contexto já hidrata na sessão e é estável dentro do componente).
   - Manter `supabase.auth.getUser()` apenas como fallback caso `useAuth` ainda não tenha hidratado.
   - Se ao final ainda não houver `user.id`, **abortar** o submit com `toast.error("Sessão expirada. Faça login novamente para abrir o chamado.")` em vez de gravar com `opened_by: null`.
   - Aplicar o id resolvido em `opened_by` e `assigned_to` no insert.

2. **Backfill do #01651** (e quaisquer outros chamados manuais órfãos)
   - Migration única setando `opened_by = assigned_to = <user atual logado quando aplicar a correção>` é arriscada porque não sabemos quem criou. Em vez disso, faremos um update apenas em **#01651**, usando o `user_id` do operador que o usuário indicar (pergunto antes de aplicar) — ou, se preferir, deixar como está e apenas evitar novos casos.

## Detalhes técnicos

- Trecho alvo em `ticket-create-dialog.tsx` (após `setLoading(true)`):
  ```ts
  const { user } = useAuth(); // adicionado no topo do componente
  // ...
  let creatorId = user?.id ?? null;
  if (!creatorId) {
    const { data: { user: fallback } } = await supabase.auth.getUser();
    creatorId = fallback?.id ?? null;
  }
  if (!creatorId) {
    toast.error("Sessão expirada. Faça login novamente para abrir o chamado.");
    setLoading(false);
    return;
  }
  // ...
  opened_by: creatorId,
  assigned_to: creatorId,
  ```
- Sem mudanças em RLS, schema, ou no fluxo de finalize. O painel de detalhes (`ticket-detail-panel.tsx` linha 954) e a lista (`ticket-list-view.tsx` linha 68) já leem `opened_by` corretamente — passarão a mostrar o nome assim que o campo for preenchido.

## Pergunta antes de aplicar

Você quer que eu **também faça backfill manual do #01651** (preciso saber qual operador criou) ou só corrijo daqui para frente?
