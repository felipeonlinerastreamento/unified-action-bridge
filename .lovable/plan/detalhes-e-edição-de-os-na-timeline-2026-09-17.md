# Detalhes e edição de OS na Timeline

## Alteração
- Ao clicar em uma OS na Timeline, abrir a mesma janela de detalhes usada em Atividades, com as abas **Detalhes** e **Histórico**.
- Exibir o botão **Editar** para Admin e Gestor, permitindo alterar dados e status com as mesmas regras da tela Atividades.
- Após salvar, atualizar a Timeline para refletir imediatamente horário, técnico, dados e status.

## Detalhes técnicos
- Reutilizar o componente existente de detalhes da OS, sem duplicar formulários ou regras.
- Passar o registro completo recebido pela Timeline para a janela de detalhes.
- Aplicar a mesma verificação de função usada em Atividades.
- Manter o aviso atual caso a integração do Seu Instalador recuse uma alteração ou transição de status.
