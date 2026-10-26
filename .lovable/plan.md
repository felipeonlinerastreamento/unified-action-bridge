# Responder a todos (incluindo quem está em cópia)

## O que muda para o atendente
Na aba Comentários dos chamados abertos por e-mail, embaixo da caixa "Enviar resposta por e-mail para cliente@...", aparece uma segunda opção:

- [ ] Enviar resposta por e-mail para cliente@...
  - ( ) Somente para o remetente
  - ( ) Responder a todos — lista quem vai receber (Para e Cópia), ex.: "joao@empresa.com, maria@empresa.com (cópia)"

A escolha só aparece quando a primeira caixa está marcada. Por padrão vem "Somente para o remetente". Se o e-mail original não tinha mais ninguém em cópia, a opção "Responder a todos" fica desativada e mostra "sem outros destinatários".

A resposta continua na mesma conversa do e-mail, com a assinatura do atendente. O registro no histórico do chamado mostra todos os destinatários ("Resposta enviada por e-mail para X, com cópia para Y, Z").

## Regras
- "Responder a todos" usa os destinatários do último e-mail recebido do cliente nesse chamado (Para + Cópia), sem o próprio suporte@.
- Quem estava em cópia oculta no e-mail original não recebe (a Microsoft não informa quem foi).

## Detalhes técnicos
- `getTicketEmailInfo`: além do remetente, busca no Outlook a última mensagem do chamado (`toRecipients`, `ccRecipients`) e devolve a lista sem o endereço da caixa do canal.
- `replyToMessage` ganha o parâmetro `replyAll`: usa `/createReplyAll` em vez de `/createReply`. O restante (corpo, assinatura em imagem embutida, envio) não muda.
- `sendTicketEmailReply` aceita `replyAll: boolean` e grava no comentário `email_sent` a lista de destinatários.
- Painel do chamado: estado `replyAll`, opções de escolha abaixo da caixa já existente, lista de destinatários carregada junto com as informações do e-mail.
- Nenhuma mudança no banco de dados.
