# Correção: balões cortados na tela do chat

## Causa raiz

O contêiner de mensagens usa `<ScrollArea>` (Radix). Por padrão, o Radix envolve o conteúdo do `Viewport` em um `<div style="display: table; min-width: 100%">`. Em layout `table`, o `min-width: 100%` é respeitado, mas a largura cresce conforme o conteúdo intrínseco — então:

- A bolha (`max-w-[75%]`) calcula seu limite contra a largura expandida pela tabela, não contra a largura visível.
- URLs longas (ex.: link do Waze) e linhas curtas geram uma largura interna maior que a do painel.
- Resultado: a bolha vaza para baixo do painel lateral direito (Empresa/Cliente) e o texto fica cortado.

O ajuste anterior (`min-w-0` + `[overflow-wrap:anywhere]` no balão) só ajuda *depois* que a quebra é forçada — mas o `table` continua expandindo, então o efeito visual permanece.

## Mudança

Arquivo: `src/routes/central.tsx`, linha 3158 (ScrollArea que envolve as mensagens):

- Adicionar utilitário Tailwind que força o wrapper interno do Viewport a `display:block`:

```text
<ScrollArea className="flex-1 p-4 [&>div>div]:!block">
```

Isso afeta exclusivamente o `ScrollArea` da timeline do chat (não tabs do painel direito nem outras `ScrollArea` da página). Com `block`, o viewport passa a respeitar a largura do contêiner pai, fazendo o `max-w-[75%]` da bolha funcionar corretamente.

## Validação

1. Abrir conversa com mensagem longa (caso "Logística MDGEO" com link do Waze).
2. Confirmar visualmente que:
   - O balão não passa por baixo do painel direito.
   - Texto e URL quebram dentro do balão.
   - Scroll vertical continua funcionando; não aparece scroll horizontal.
3. Repetir em viewport mais estreito (~1280px) para validar responsividade.

## Não escopo

Sem alterações no componente `ScrollArea` global, em outras telas ou em lógica de negócio.
