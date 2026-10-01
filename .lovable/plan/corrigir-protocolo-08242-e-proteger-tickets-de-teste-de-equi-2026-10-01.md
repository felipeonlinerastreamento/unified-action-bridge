# Corrigir protocolo #08242 e proteger tickets de Teste de Equipamento

## O que muda
1. **Restaurar o #08242**: volta para a categoria "Teste de Equipamento", setor **Administrativo**, status **Em andamento (A resolver)**, sem data de fechamento, com um comentário no histórico explicando a restauração.
2. **Proteção na Central**: ao finalizar uma conversa nova, a Central não reaproveita mais um ticket que já foi encaminhado para outro setor pelo fluxo de Teste de Equipamento (ou por regra de categoria). Nesse caso é criado um **novo protocolo** para a nova interação, e o ticket que está na fila do Administrativo continua intacto.

## Detalhes técnicos
- Migration de dados: `UPDATE service_tickets SET category='Teste de Equipamento', sector='Administrativo', status='em_andamento', closed_at=null, closed_by=null WHERE id='bfd111f0-b829-440a-8940-56218d234159'` + insert em `ticket_comments` (tipo "sistema").
- `src/routes/central.tsx`, `finalizeMutation` (~linha 2031): na busca do ticket aberto vinculado ao chat, descartar tickets cujo setor seja o `target_sector_name` do TE (ou que tenham comentário "encaminhamento") e cuja categoria seja TE — nesses casos tratar como sem ticket vinculado e criar novo protocolo. Mesma regra na busca usada para exibir o ticket ativo do chat, para não carregar o ticket encaminhado como se fosse do atendimento atual.
