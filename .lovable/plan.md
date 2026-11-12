# Mostrar "Lançar financeiro" em todas as formas de finalizar

## O que verifiquei
A caixa "Lançar financeiro" já está no código em dois lugares:
- na janela "Finalizar atendimento?" do chamado (Atendimentos), mas fica escondida quando o chamado é **recorrente** ("Concluir ocorrência");
- na janela de finalização do chat (Central).

Ela **não** existe em outros caminhos de finalização:
- **Novo chamado → "Criar e finalizar"** (o chamado já nasce finalizado);
- chamados **recorrentes** ("Concluir ocorrência").

Além disso, a mudança ainda não foi publicada. Quem usa o endereço oficial não vê a caixa em nenhum lugar.

## O que será feito
1. **Novo chamado ("Criar e finalizar")**: adicionar a caixa "Lançar financeiro" com o campo próprio e obrigatório de detalhes. Ao criar finalizado, o chamado já recebe o selo "💰 Lançar financeiro" e o comentário com os detalhes.
2. **Chamados recorrentes**: mostrar a caixa também em "Concluir ocorrência".
3. Fazer um teste no navegador: finalizar um chamado e conferir que a caixa aparece e que o selo é mostrado.
4. Lembrar de publicar, para a mudança chegar ao endereço oficial.

## Detalhes técnicos
- `ticket-create-dialog.tsx`: novo estado `financial`/`financialNotes`, visível junto ao botão de criar e finalizar; no insert, preencher `financial_pending`, `financial_notes`, `financial_requested_by`, `financial_requested_at` e inserir o comentário de sistema; validar as notas quando a caixa estiver marcada.
- `ticket-detail-panel.tsx`: remover a condição `!ticket.is_recurring` do bloco do checkbox; `updateStatus` já recebe o parâmetro `financial`.
