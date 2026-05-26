## Causa raiz

Em `src/lib/ticket-finalize-flow.ts`, o bloco do fluxo Teste de Equipamento (linhas 129–231) faz:

1. Lê o estado vivo do ticket no banco.
2. Calcula `alreadyRouted` (mesmo setor + mesmo status `aberto` + sem `closed_at`).
3. Se **não** está roteado, atualiza para `aberto`/setor destino e **dá `return`**.
4. Se **já está roteado**, **não dá `return`** — a execução cai no bloco 2 (regras de categoria) e, se não encontra regra que mude o setor, despenca até o **bloco 4 "Standard finalize"** (linhas 363–378), que sobrescreve para `status = finalizado` e seta `closed_at = now()`.

Fluxo real do problema:
- Operador finaliza chat com categoria "Teste de Equipamento".
- `mutationFn` em `central.tsx` (linhas 1662–1705 ou 1782–1811) já cria/atualiza o ticket como `aberto` no setor **Administrativo** (correto).
- `onSuccess` chama `finalizeTicketWithFlow`. Como o ticket já está `aberto`/Administrativo, `alreadyRouted = true`, o bloco TE é pulado, **não retorna**, e o bloco 4 finaliza o ticket.

Confirmado pelo banco — últimos tickets TE estão com `sector = Administrativo` e `status = finalizado`.

## Correção

Arquivo: `src/lib/ticket-finalize-flow.ts`

Quando a categoria casa com Teste de Equipamento e o fluxo TE está habilitado, **sempre retornar** depois de avaliar — seja após rotear, seja após detectar que já estava roteado. Ou seja: dentro do `if (settings?.is_enabled && isTesteEquipamentoCategory(...) && settings.target_sector_name)`, adicionar um `return { routed: true, routedTo: { sector: settings.target_sector_name, status: targetStatus } }` no caminho `alreadyRouted`, em vez de cair para os blocos 2 e 4.

Aplicar a mesma proteção no bloco 2 (regras de categoria): se o ticket já está no setor destino da regra (`alreadyRouted`), retornar `{ routed: true, routedTo: ... }` em vez de cair na finalização padrão.

Resumo do efeito:
- Ticket TE recém-roteado → permanece `aberto` em Administrativo (atendente verá em "A resolver").
- Tickets sem categoria configurada → continuam indo para `finalizado` normalmente (bloco 4).

## Backfill

Atualizar os tickets TE recém-fechados incorretamente que ainda têm `sector = 'Administrativo'` e `status = 'finalizado'` (últimas ~24h) para `status = 'aberto'`, `closed_at = NULL`, `closed_by = NULL`, para que o setor Administrativo consiga resolvê-los. Os tickets antigos sem `sector` ficam como estão (já não tem destino).

## Arquivos

- editar `src/lib/ticket-finalize-flow.ts`
- migration de backfill para os tickets TE listados (3 tickets recentes com `sector = Administrativo`)
