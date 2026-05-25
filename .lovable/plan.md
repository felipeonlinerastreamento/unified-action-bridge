## Problema

No ticket #01568 (categoria "Teste de Equipamento"), ao clicar em **Finalizar** o sistema mostra a mensagem de sucesso, mas o status continua `aberto` no setor `Administrativo`. Isso ocorre porque a rotina `finalizeTicketWithFlow` (em `src/lib/ticket-finalize-flow.ts`) tem um bloco específico para TE que **propositalmente não fecha o ticket** — ele apenas reencaminha para Administrativo e mantém `status = aberto`.

## Mudança

Remover esse bloco especial de TE. A partir de agora, ao clicar em **Finalizar** num ticket de Teste de Equipamento, o comportamento será igual ao das demais categorias: `status = finalizado`, `closed_at = agora`, `closed_by = usuário`, e (se habilitado) sincroniza com o GSystem.

Nenhuma outra regra é afetada:
- A regra geral de roteamento por categoria (bloco "routing rules") continua intacta.
- O fluxo padrão de finalize continua intacto.
- As configurações de Teste de Equipamento (Configurações → Teste Equipamento) continuam existindo; apenas o efeito colateral de "ao finalizar, reabre em Administrativo" deixa de ocorrer. O sync com GSystem do fluxo TE permanece (será disparado pelo fluxo padrão de finalize).

## Arquivos

- `src/lib/ticket-finalize-flow.ts` — remover o bloco `if (isTE && teEnabled) { ... return { routed: true } }` (linhas ~120–245), deixando o ticket cair direto no "Standard finalize" (linhas ~367+). Imports relacionados (`isTesteEquipamentoCategory`, `teSettings`, `normalizeFlowText`) só são removidos se ficarem sem uso após a remoção — caso contrário ficam.

## Verificação após implementação

1. Abrir o ticket #01568, clicar em Finalizar → status passa a `finalizado`, `closed_at` preenchido.
2. Criar/abrir outro ticket de categoria diferente e finalizar → comportamento inalterado.
3. Conferir no Kanban/Lista que tickets TE finalizados aparecem na coluna "Finalizados".
