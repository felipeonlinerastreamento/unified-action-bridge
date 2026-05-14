## Causa

Em `src/components/atendimentos/atendimentos-content.tsx` o fetch de itens/pedidos de compra (e dos demais sub-itens) usa:

```ts
.in("ticket_id", ids)
```

onde `ids` contém **todos os 955 chamados** retornados de `service_tickets`. Isso gera uma URL com ~35 KB (955 UUIDs), acima do limite prático do PostgREST/edge — a resposta volta vazia ou truncada de forma silenciosa. Resultado: para o setor Compras, só o ticket que tem `service_tickets.tracking_code` preenchido (`178bd2dd…`) consegue exibir alguma coisa, porque esse valor já vem direto do select principal. Os outros 5 chamados ficam sem `purchase_items` e sem `purchase_request`, então o `ComprasInfo` retorna `null`.

Os dados existem no banco (verifiquei: 6 chamados em Compras, todos com 1 item e 5 com `ticket_purchase_requests` em status `solicitado`).

## Correção

Como `ticket_purchase_items` (11 linhas), `ticket_purchase_requests` (6), `ticket_liberacao_items` (61), `ticket_suprimento_items` (4) e `ticket_compra_equipamento_items` (3) são tabelas pequenas, trocar o `.in("ticket_id", ids)` por um SELECT completo da tabela e indexar por `ticket_id` no cliente. Isso elimina o limite de URL e mantém o mesmo agrupamento.

Para `ticket_comments` (719 linhas, ainda dentro do limite hoje, mas crescendo), aplicar chunking de 200 IDs por chamada e mesclar resultados — assim não regride no futuro.

## Arquivos

- `src/components/atendimentos/atendimentos-content.tsx`
  - substituir os 5 fetches de itens/pedido por SELECT sem `.in(...)` 
  - envolver o fetch de `ticket_comments` num helper que faz batches de 200 IDs

## Validação

- Filtrar por setor Compras → todos os 6 chamados devem mostrar o balão com itens e o status do pedido (e o de tracking quando houver código).
- Demais setores (Liberação, Suprimentos, Compra Equipamento) continuam exibindo seus respectivos balões normalmente.
