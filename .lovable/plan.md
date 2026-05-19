# Corrigir popover de Respostas Rápidas fechando ao mover o mouse

## Problema

Em `src/routes/central.tsx` o item "Respostas rápidas" vive dentro de um `DropdownMenu`. Ao clicar, o handler faz:

```ts
onSelect={(e) => { e.preventDefault(); setTimeout(() => setQuickRepliesOpen(true), 0); }}
```

E o `QuickRepliesPopover` é renderizado com `hideTrigger` (um botão `sr-only` posicionado fora da tela como âncora).

Dois efeitos combinam para fechar o popover assim que o mouse entra nele:

1. **Âncora `sr-only` fora da tela**: o `PopoverContent` se posiciona em relação a um botão de 1px no canto, não próximo do botão "Mais opções" visível. O conteúdo aparece em local inesperado.
2. **Fechamento ao primeiro pointer-down/move "fora"**: o `DropdownMenu` que acabou de fechar ainda libera eventos de ponteiro que o Radix Popover interpreta como interação externa (porque o `setTimeout(…, 0)` abre o popover antes do dropdown terminar o ciclo de close). Ao mover o mouse para os itens ou para "Gerenciar", o evento já fecha o popover.

## Correção (apenas frontend, escopo mínimo)

Editar **somente** `src/components/central/quick-replies-popover.tsx` e o ponto de uso em `src/routes/central.tsx`:

1. **Substituir o âncora `sr-only` por um trigger real, porém invisível**, mantendo as dimensões e posição do botão "Mais opções", para que o popover apareça grudado ao botão. Implementação: quando `hideTrigger=true`, renderizar um `<button>` com `className="pointer-events-none opacity-0 absolute inset-0"` dentro de um wrapper relativo — ou expor um `anchorRef` opcional. Caminho mais simples: deixar de usar `hideTrigger` e mostrar o próprio botão `Zap` do popover ao lado do "Mais opções", removendo o item duplicado do `DropdownMenu`.

   Decisão proposta: **remover o item "Respostas rápidas" do `DropdownMenu`** e mostrar o `QuickRepliesPopover` (com seu botão `Zap` padrão) diretamente na toolbar do input, ao lado dos outros botões (anexar, microfone, etc.). Isso elimina o conflito Dropdown↔Popover e a âncora fantasma. O usuário continua acessando "Gerenciar" pelo próprio popover.

2. **Garantir que o `PopoverContent` não feche em interações internas**: adicionar `onOpenAutoFocus={(e) => e.preventDefault()}` (evita roubo de foco causar reabertura/close) e manter `modal={false}` (default) — não é preciso mais nada, pois sem o dropdown intermediário o ciclo de eventos fica limpo.

3. **Botão "Gerenciar respostas rápidas"**: trocar o `onClick` por `onSelect` envolvendo em um `CommandItem` dentro do mesmo `CommandList` (ou manter `Button` mas usar `onMouseDown` em vez de `onClick`, para disparar antes de qualquer "outside pointer down" potencialmente disparado). Manter o comportamento: fecha popover + abre `QuickRepliesManagerDialog`.

## Arquivos alterados

- `src/components/central/quick-replies-popover.tsx`
  - Remover `hideTrigger` ou torná-lo um trigger invisível âncora; adicionar `onOpenAutoFocus` no `PopoverContent`; trocar `onClick` do "Gerenciar" para `onMouseDown`.
- `src/routes/central.tsx`
  - Remover o `DropdownMenuItem` "Respostas rápidas" e o estado `quickRepliesOpen` controlado externamente.
  - Renderizar `<QuickRepliesPopover size="icon" onPick={…} />` direto na toolbar do input (mesmo `onPick` atual com `applyQuickReplyVars`).

## Fora de escopo

- Sem mudanças na tabela `zapi_quick_replies`, sem mudanças no `QuickRepliesManagerDialog`, sem mudanças na tela de Configurações → Respostas Rápidas.
