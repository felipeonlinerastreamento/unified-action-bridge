# Corrigir a integração de e-mail (suporte@onlinerastreamento.com.br)

## O que está acontecendo hoje

Os três canais cadastrados (Suporte, Comercial, Felipe) estão ativos e sendo verificados a cada minuto, mas **todas** as verificações falham com "chave inválida" ao falar com o Outlook. Nenhum e-mail vira atendimento.

## Análise FMEA

| # | Falha | Causa | Efeito | Gravidade / Detecção |
|---|-------|-------|--------|----------------------|
| 1 | Acesso ao Outlook recusado (erro 401 a cada minuto, nos 3 canais) | A conta Microsoft está autorizada na sua área de integrações, mas **não está vinculada a este projeto**; o sistema ainda usa uma chave avulsa antiga guardada à mão | Nenhum e-mail lido, nenhum atendimento criado | Alta / Baixa — o erro só aparece no banco, não na tela |
| 2 | Os três canais leem a **mesma** caixa de entrada | O código sempre lê "a caixa da conta conectada", ignorando o endereço configurado no canal | Assim que o acesso voltar, o mesmo e-mail viraria 3 atendimentos duplicados | Alta / Baixa |
| 3 | Marcar como lido | Como todos leem a mesma caixa, um canal marca como lido o e-mail do outro | Perda de mensagens | Média / Baixa |
| 4 | Falha silenciosa | A tela de configuração não mostra o resultado da última verificação | O erro ficou dias sem ser percebido | Média / Alta (depois da correção) |
| 5 | Só 25 mensagens por rodada, sem paginação | Limite fixo | Em picos, mensagens ficam para trás (mitigado por rodar a cada minuto) | Baixa / Média |

## Correção

1. **Vincular a conta Microsoft ao projeto** (abre o cartão de conexão no chat para você escolher a conta que tem acesso a suporte@, comercial@ e felipe@). Passar a usar a credencial oficial dessa conexão e a chave da plataforma, em vez das chaves avulsas antigas.
2. **Cada canal lê a sua própria caixa**: a leitura passa a usar o endereço configurado no canal. Se a conta conectada não tiver permissão naquela caixa, o canal registra um aviso claro em vez de ler a caixa errada.
3. **Proteção contra duplicidade**: o registro de "já processado" passa a considerar também o identificador da mensagem, e um e-mail já transformado em atendimento nunca gera um segundo.
4. **Visibilidade na tela**: em Configurações → Integração de E-mail, cada canal mostra a hora da última verificação, se deu certo, o erro em português e um botão "Verificar agora" com o resultado (quantos e-mails lidos, quantos atendimentos criados).
5. **Teste real**: enviar um e-mail para suporte@ e confirmar que aparece um atendimento novo na fila.

## Detalhes técnicos

- `src/lib/outlook.server.ts`: trocar `CUSTOM_LOVABLE_API_KEY` por `LOVABLE_API_KEY` e usar o segredo da conexão vinculada; `listUnreadMessages(mailbox, limit)` e `markMessageAsRead(mailbox, id)` passam a usar `/users/{endereço}/mailFolders/inbox/messages` quando o endereço difere da conta conectada, com fallback para `/me`; tratar 403/404 do Graph com mensagem em português ("conta conectada sem permissão nesta caixa").
- `src/lib/email-poll.server.ts`: passar `channel.email_address` para as chamadas; checar duplicidade por `message_id` **ou** `internet_message_id`; gravar `last_poll_status`/`last_poll_error` também no caminho de sucesso parcial (já existe) e contar erros por mensagem.
- `src/components/configuracoes/email-channels-config.tsx`: exibir `last_polled_at`, `last_poll_status`, `last_poll_error` e botão de verificação manual usando `triggerEmailPoll`.
- Sem alteração de schema. O cron `email-poll-office365` (1 min) já existe e está correto.
- Observação: a correção só passa a funcionar no site publicado depois de publicar o app.
