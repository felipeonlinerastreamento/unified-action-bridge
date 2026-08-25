# Corrigir atribuições para usuários inativos

## Implementação
- Corrigir a rotina de inativação para atualizar o perfil com a sessão administrativa autenticada e concluir a limpeza dos vínculos operacionais.
- Impedir que perfis inativos apareçam nos seletores de atendentes e transferências.
- Validar o responsável já vinculado antes do roteamento automático; se estiver inativo, escolher outro operador ativo.
- Corrigir o estado da Annaylle no banco e retirar seus vínculos atuais de chats/chamados abertos.

## Validação
- Confirmar que Annaylle está inativa, sem setor e sem atribuições operacionais abertas.
- Validar compilação e os caminhos de seleção/roteamento alterados.
