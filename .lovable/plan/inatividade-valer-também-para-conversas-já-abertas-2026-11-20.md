# Inatividade: valer também para conversas já abertas

## Como vai funcionar
- **Ativada:** a próxima mensagem do cliente em qualquer conversa recebe a mensagem configurada, uma única vez. Isso vale para conversas novas, reabertas e as que já estavam abertas no momento em que a chave foi ligada.
- **Uma vez por conversa:** depois de enviada, ela não se repete enquanto a conversa estiver aberta. Se a conversa for finalizada e o cliente voltar, ele recebe de novo.
- **Desligar e ligar de novo:** todas as conversas voltam a poder receber uma vez.
- **Desativada:** segue o fluxo normal, sem nenhuma mensagem.
- **Continua igual:** grupos (inclusive o dos técnicos) ficam de fora; a mensagem vai depois das boas-vindas/menu do bot; aparece no chat como "(Mensagem automática)"; fora do horário vale só o aviso de ausência.

## Detalhes técnicos
- Nova coluna `enabled_at` em `inactivity_message_settings`, gravada quando a chave passa de desligada para ligada.
- O webhook deixa de exigir `isNewConversation`: envia quando `inactivity_message_sent_at` for vazio ou anterior a `enabled_at`. A reserva atômica continua, comparando com `enabled_at`, para não enviar em duplicidade.
- A reabertura de uma conversa finalizada continua limpando `inactivity_message_sent_at`.
- Atualizar a regra pura em `src/lib/inactivity-message.ts` e os testes: conversa aberta recebe uma vez depois de ativar; não repete; religar libera de novo; grupo e fora do horário não recebem.
- Atualizar o texto de ajuda do quadro Inatividade e a memória do projeto.
- O envio real só funciona depois de publicar.
