## Adicionar botão "Copiar Protocolo"

Adicionar um botão de copiar ao lado do número do protocolo em dois locais:

1. **Lista de atendimentos** (`ticket-list-view.tsx`) — ao lado do `#protocolo` no card de cada ticket.
2. **Painel de detalhes do chamado** (`ticket-detail-panel.tsx`) — na parte superior, ao lado do badge do protocolo no `SheetTitle`.

### Implementação
- Usar `navigator.clipboard.writeText()` para copiar o número do protocolo puro (sem `#`).
- Exibir ícone `Copy` (lucide-react) que muda para `Check` por 1,5s após o clique.
- Usar `Button` com `variant="ghost"` e `size="icon"` para manter o estilo discreto.
- Mostrar toast `Protocolo copiado` via sonner.

### Arquivos
- `src/components/atendimentos/ticket-list-view.tsx`
- `src/components/atendimentos/ticket-detail-panel.tsx`