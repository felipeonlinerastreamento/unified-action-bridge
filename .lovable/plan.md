# Contador de novos lançamentos no menu Top Gamific

## O que muda para o usuário

1. Sempre que a plataforma de gamificação registrar um novo lançamento para o usuário, aparece um selo vermelho com o número de lançamentos novos ao lado do item "Top Gamific" no menu lateral (mesmo estilo dos selos de Atendimentos e Chat com Operadores).
2. Ao abrir a página Top Gamific, os lançamentos ainda não vistos aparecem destacados, com um campo de marcação "Ciente" em cada um e um botão "Marcar todos como ciente".
3. Ao marcar "Ciente", o lançamento deixa de contar e o selo do menu some (ou diminui). Nada é apagado: o lançamento continua na lista, só perde o destaque.
4. O selo é por usuário: cada pessoa vê apenas o contador dos próprios lançamentos.

## Comportamento detalhado

- Contagem = lançamentos do usuário nos últimos 90 dias que ainda não foram marcados como ciente.
- Primeira vez que o usuário abre o sistema depois desta mudança: para não aparecer um número enorme de lançamentos antigos, só contam lançamentos a partir do momento em que o recurso entra em uso (o primeiro carregamento marca os já existentes como vistos).
- O selo atualiza automaticamente a cada 2 minutos e ao abrir/atualizar a página.
- Limite de exibição "99+" como nos demais selos.
- A página passa a listar os últimos 10 lançamentos (hoje são 3), para que o usuário consiga dar ciência em todos os novos.

## Detalhes técnicos

**Banco** — nova tabela `topgamific_entry_acks`:
- `id uuid pk`, `user_id uuid not null`, `entry_id text not null`, `acked_at timestamptz default now()`, `unique (user_id, entry_id)`.
- GRANT SELECT/INSERT/DELETE para `authenticated`, ALL para `service_role`; RLS habilitada com políticas `user_id = auth.uid()` em select/insert/delete.

**Server functions** (`src/lib/topgamific.functions.ts`):
- `getTopGamificOverview`: passa a devolver os últimos 10 lançamentos, cada um com `acknowledged: boolean`, mais `unseenCount`. Faz uma consulta a `topgamific_entry_acks` do usuário e cruza pelo `entry.id`.
- Novo `getTopGamificUnseenCount` (leve, usado pelo menu): busca `/entries` dos últimos 90 dias, filtra os do usuário e subtrai os já marcados; em caso de falha da API retorna 0 (sem selo), nunca erro na tela.
- Novo `ackTopGamificEntries({ entryIds })`: insere (upsert, ignorando duplicados) os ids marcados para o usuário atual.
- Bootstrap da primeira vez: se o usuário ainda não tem nenhuma linha em `topgamific_entry_acks`, a primeira chamada de contagem grava todos os lançamentos atuais como vistos e devolve 0.

**Menu** (`src/components/app-sidebar.tsx`):
- `useQuery(["sidebar-topgamific-unseen", userId])` chamando `getTopGamificUnseenCount` via `useServerFn`, `refetchInterval: 120000`, só quando o item "/top-gamific" está visível para o usuário.
- Renderiza o mesmo `Badge` vermelho já usado nos outros itens quando a contagem for > 0.

**Página** (`src/routes/top-gamific.tsx`):
- Cada lançamento não marcado recebe borda/realce e um `Checkbox` "Ciente"; ao marcar, chama `ackTopGamificEntries` com esse id, atualiza o cache local e invalida `["sidebar-topgamific-unseen"]` para o selo sumir na hora.
- Botão "Marcar todos como ciente" no cabeçalho do card de lançamentos, visível só quando há itens não marcados.
- Título do card passa a ser "Últimos lançamentos" com contador de novos.
