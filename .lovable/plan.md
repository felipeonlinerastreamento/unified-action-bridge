## Ajuste da mensagem de finalização

Ao finalizar um atendimento que cai na regra de roteamento automático (ex: categoria "Teste de Equipamento"), o toast atual exibe:

> "Encaminhado para Administrativo"

O operador solicitou que a mensagem seja simplificada para:

> "Atendimento finalizado"

Sem afetar outras regras de encaminhamento manual.

### Arquivos a alterar

- `src/components/atendimentos/ticket-detail-panel.tsx` — linha 448
- `src/components/atendimentos/ticket-kanban-view.tsx` — linha 74
- `src/routes/central.tsx` — linha 2095

Em cada um, substituir:
```ts
toast.success(`Encaminhado para ${res.routedTo.sector}`);
```

Por:
```ts
toast.success("Atendimento finalizado");
```

As mensagens de sincronização com GSystem (quando aplicável) permanecem inalteradas. Encaminhamentos manuais para usuários/setores não são afetados.