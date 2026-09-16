# Robô de Atendimento — análise FMEA e melhorias

## Situação encontrada hoje

A tela Configurações → Robô de Atendimento já existe, mas ela **não está ligada ao robô de verdade**:

- Tudo que você configura ali (robô ligado/desligado, espera de 10s, segunda cobrança, horário, catálogo e automações) é salvo **apenas no navegador de quem configurou**. Outro usuário, outro computador ou o modo anônimo não enxergam nada, e o servidor nunca lê essas regras.
- O robô que realmente responde no WhatsApp é outro: o fluxo de nós (menu, perguntas, boleto, agente de IA) do editor de fluxo. Ele ignora completamente as automações do catálogo.
- O texto de ajuda das variáveis na janela de edição está quebrado, mostrando `{{operatorName}*` e um aviso de "temporariamente sem chave dupla".
- Não existe espera de 10 segundos, nem segunda cobrança, nem coleta de placa/período, nem painel de perguntas frequentes — são só campos de tela.

Ou seja: hoje o menu passa a impressão de estar ativo, mas nenhuma resposta automática dele chega ao cliente.

## Análise FMEA do menu do robô

| # | Falha possível | Efeito para a operação | Gravidade | Como corrigir |
|---|---|---|---|---|
| 1 | Configuração salva só no navegador | Gestor configura e nada acontece; ninguém mais vê as regras | Crítica | Guardar no banco (tabelas próprias) e ler pelo servidor |
| 2 | Catálogo desconectado do robô real | Automações "habilitadas" nunca respondem | Crítica | Motor do robô passa a consultar as automações antes do fluxo de nós |
| 3 | Sem registro do que o robô fez | Impossível auditar ou melhorar | Alta | Registro por conversa: regra aplicada, dados coletados, resultado |
| 4 | Sem trava contra resposta duplicada | Cliente recebe duas mensagens iguais | Alta | Controle de última resposta por conversa + tempo mínimo |
| 5 | Robô pode responder depois do operador | Conflito e cliente confuso | Alta | Antes de enviar, conferir se houve mensagem do operador |
| 6 | Horário configurado não é respeitado | Resposta de madrugada | Média | Usar o horário da tela e o horário de atendimento já existente |
| 7 | Nome do operador pode vir vazio ou inativo | Mensagem "Fala com ," | Média | Só operadores ativos; se não houver, usa texto alternativo |
| 8 | Fila de destino é campo livre de texto | Erro de digitação manda para setor inexistente | Média | Trocar por seleção dos setores cadastrados |
| 9 | Palavras-chave sem acento/variação | Robô não reconhece o assunto | Média | Comparar sem acento, sem maiúsculas e por trecho |
| 10 | IA indisponível ou sem crédito | Robô trava a conversa | Média | Falhar em silêncio e liberar para o operador |
| 11 | Grupos e conversas já em andamento | Ruído e resposta indevida | Média | Robô só em conversas individuais e novas |
| 12 | Dado coletado em formato errado (placa) | Técnico recebe lixo | Baixa | Validar formato e pedir uma única vez de novo |
| 13 | Texto de variáveis quebrado na tela | Gestor escreve a variável errada e ela não é trocada | Baixa | Corrigir a legenda e listar as variáveis válidas |

## Melhorias no menu

1. **Persistência real no banco**, com as regras valendo para toda a empresa e histórico de quem alterou.
2. **Ligar o catálogo ao robô**: primeiro as palavras-chave, depois a IA classifica; se nada casar, segue para o operador.
3. **Seleção de setor por lista** em vez de texto livre, usando os setores ativos.
4. **Testador de mensagem**: campo para digitar uma frase e ver qual automação responderia e o que o robô pediria — sem enviar nada ao cliente.
5. **Modo observação**: robô classifica e registra, mas não envia, para você conferir o acerto antes de ligar de vez.
6. **Painel de perguntas frequentes**: assuntos mais detectados no período, quantos o robô resolveu sozinho e quais mensagens ele não entendeu.
7. **Legenda de variáveis corrigida** com a lista do que pode ser usado no texto.
8. **Prévia da mensagem** já com o nome do operador e do cliente preenchidos.

## Novas possibilidades de configuração

- Ativar o robô por canal de WhatsApp, e não só globalmente.
- Limite de respostas automáticas por conversa (ex.: no máximo 2).
- Silenciar o robô para contatos marcados como VIP ou para clientes já com chamado aberto.
- Mensagem diferente dentro e fora do horário de atendimento.
- Prioridade entre automações, quando a mensagem casa com mais de uma.
- Encerrar sozinho a conversa se o cliente não responder em X horas.
- Definir por automação se ela abre chamado automaticamente e com qual prioridade.

## Sistema sugerir respostas

Duas camadas, ambas configuráveis:

1. **Sugestão para o gestor (na tela do robô)**: a partir das mensagens reais recebidas, o sistema agrupa as perguntas que mais se repetem e ainda não têm automação, propõe nome, palavras-chave e um texto de resposta pronto. Você revisa e clica em "Criar automação".
2. **Sugestão para o operador (na conversa)**: quando o operador abre um chat, aparece um texto sugerido com base no assunto detectado e no histórico do cliente. O operador pode enviar como está, editar antes de enviar ou ignorar. Nada é enviado sozinho nesse modo.

Ambas usam a IA já disponível no sistema e continuam funcionando sem ela (caem nas palavras-chave).

## Detalhes técnicos

- Tabelas novas: `bot_auto_reply_settings` (singleton: ativo, espera da saudação, segunda cobrança, janela de horário, canal, modo observação, limite por conversa), `bot_auto_reply_rules` (nome, palavras-chave, texto, campos exigidos, setor, prioridade, ativa, origem catálogo, abre chamado), `bot_auto_reply_log` (chat_id, message_id, regra, intenção IA, confiança, dados coletados, enviado/simulado). RLS + GRANT: leitura para autenticados, escrita para admin/gestor.
- `bot-auto-reply-config.tsx` migra de `localStorage` para TanStack Query + Supabase; setor vira `Select` alimentado por `sectors` ativos; legenda de variáveis corrigida (`{{operatorName}}`, `{{contactName}}`).
- Motor: nova etapa em `src/lib/zapi-bot.server.ts` (ou módulo `bot-auto-reply.server.ts`) chamada pelo webhook `api.public.zapi-webhook.$channelId.tsx` antes de `findActiveFlow`; sai sem agir quando há mensagem do operador, quando é grupo, fora da janela, ou quando o log já registrou resposta recente.
- Agendamento dos 10s e da segunda cobrança: rota pública `api.public.bot-auto-reply-scanner.tsx` no padrão de `api.public.chat-idle-scanner.tsx`, disparando o que venceu — o webhook nunca segura a resposta.
- Classificação e sugestões por IA: Lovable AI Gateway com saída estruturada (intenção + confiança); erros 402/429 apenas registram no log e liberam para o operador.
- Envio por `zapiSendText` e persistência em `zapi_messages`, como as demais automações.
- Sugestão ao operador: server function que recebe `chat_id` e devolve o texto proposto; a Central mostra em um cartão acima do campo de mensagem.
