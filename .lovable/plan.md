

## Plano: Categoria obrigatória ao finalizar atendimento (sincronizada com GSystem)

### Situação atual
O dialog de finalização já possui o campo "Tipo de pendência" buscando os tipos do GSystem via `getTiposPendencia`. Porém:
1. Não há um seletor de categoria visível no header do chat (ao lado do botão Finalizar)
2. A seleção do tipo de pendência **não é obrigatória** — o operador pode finalizar sem selecionar
3. O tipo não é exibido como contexto durante o atendimento

### O que será feito

**1. Seletor de categoria no header do chat**
- Adicionar um `Select` compacto ao lado do botão "Finalizar" no header da conversa (linha ~1390 de `central.tsx`)
- Alimentado pela mesma query `tiposPendencia` já existente do GSystem
- O valor selecionado será armazenado no state `finalizeTipoPendencia` já existente, pré-preenchendo o dialog de finalização

**2. Tornar a categoria obrigatória na finalização**
- No botão "Finalizar" do dialog (linha ~2241), adicionar `disabled` quando `finalizeTipoPendencia` estiver vazio
- Adicionar indicador visual `*` no label do campo "Tipo de pendência"
- Se o operador clicar em Finalizar sem categoria, exibir toast de erro

**3. Sincronização visual**
- Se o operador selecionar a categoria no header, ela já vem preenchida no dialog
- Se alterar no dialog, o header reflete a mudança (mesmo state)

### Arquivo modificado
- `src/routes/central.tsx`

### Detalhes técnicos
- State `finalizeTipoPendencia` já existe — será reutilizado para o seletor inline no header
- Query `tiposPendencia` já existe e busca de `/pendencias/tipos` do GSystem
- O botão Finalizar no dialog receberá `disabled={!finalizeTipoPendencia || finalizeMutation.isPending}`
- O seletor inline terá `className="w-[180px] h-8"` para caber no header sem quebrar layout

