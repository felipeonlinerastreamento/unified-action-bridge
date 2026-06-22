## Problema

Campos numéricos (Qtd., Valor, etc.) começam com `0` por padrão e, ao apagar, o `onChange` faz `Number("") || 0`, voltando para `0` na hora — impossível digitar um valor novo sem antes selecionar o "0" manualmente.

## Solução

Padronizar o comportamento em todos os inputs `type="number"` de lançamento de itens:

- Exibir **vazio** quando o valor for `0` (ou `null`/`undefined`).
- No `onChange`, manter `""` como `0` internamente (para os cálculos continuarem funcionando), mas **sem reescrever o "0" no campo**.
- O usuário consegue limpar o campo, digitar o novo número, e o valor é gravado normalmente.

## Arquivos a atualizar

Todos os inputs numéricos de itens/quantidades/valores nestes componentes:

- `src/components/crm/crm-pipeline-tab.tsx` — Qtd., Ativação (R$), Mensalidade (R$) da proposta.
- `src/components/atendimentos/liberacao-equipamento-fields.tsx` e `ticket-liberacao-section.tsx` — quantidade.
- `src/components/atendimentos/suprimento-fields.tsx` e `ticket-suprimento-section.tsx` — quantidade.
- `src/components/atendimentos/compra-equipamento-fields.tsx` e `ticket-compra-equipamento-section.tsx` — quantidade/valor.
- `src/components/atendimentos/perdidos-fields.tsx` e `ticket-perdidos-section.tsx` — quantidade/valor.
- `src/components/atendimentos/purchase-fields.tsx` e `ticket-purchase-section.tsx` — quantidade/valor.

Padrão aplicado em cada `<Input type="number" ...>`:

```tsx
value={it.quantity === 0 ? "" : it.quantity}
onChange={(e) => {
  const raw = e.target.value;
  const n = raw === "" ? 0 : Number(raw);
  // grava n (mantém 0 quando vazio para totais)
}}
```

Sem alteração de schema, sem alteração de validações de submit já existentes (que continuam exigindo `quantity >= 1` quando aplicável).
