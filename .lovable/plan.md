# Robô de primeiro atendimento

Um robô que recebe a conversa antes do operador, garante que ela já entre em uma fila com responsável, responde saudações vazias e coleta as informações que faltam (placa, período etc.) para o técnico receber o chamado pronto.

## Como vai funcionar

1. **Toda conversa nova entra na fila "Atendimento"** e recebe na hora o operador daquela fila com menos atendimentos (preferindo quem está online). Hoje isso já acontece na reabertura de conversas; passa a valer também para o primeiro contato.
2. **Mensagem sem conteúdo útil** ("oi", "bom dia", "preciso de ajuda"): o robô espera 10 segundos e responde:

```text
Olá,
Fala com {nome do operador responsável pelo chamado},

Em que posso ajudar?
```

3. **Mensagem com assunto identificado**: o robô responde a automação configurada para aquele assunto e pergunta os dados que faltam. Ex.: cliente pede relatório sem informar placa → o robô pede placa e período.
4. **Se o cliente não responder o dado pedido**, o robô aguarda 10 minutos e pergunta uma única vez de novo. Depois disso libera para o operador com o que já tem.
5. **Tudo que o robô coletar** (assunto detectado, placa, período, respostas) fica registrado no chamado, visível para o operador e para o técnico.
6. O robô nunca responde depois que o operador já enviou uma mensagem na conversa, nem em grupos, nem fora do horário de atendimento configurado.

## Como o robô entende a mensagem

Primeiro passam as **regras de palavra-chave** que você cadastra. Se nenhuma casar, a **IA** classifica a intenção entre as automações habilitadas e escolhe a resposta; se a IA também não tiver certeza, o chat segue sem resposta automática para o operador atender.

## Tela de configuração (novo menu: Configurações → Robô de Atendimento)

- Liga/desliga geral, tempo de espera da saudação (padrão 10s), tempo da segunda cobrança (padrão 10min), horário em que o robô atua.
- **Catálogo de sugestões prontas** para habilitar com um clique, cada uma já com texto e dados exigidos:
  - Relatório de posições → exige placa e período
  - Rastreamento / localização do veículo → exige placa
  - Equipamento sem comunicação → exige placa
  - Instalação / agendamento → exige cidade e período desejado
  - Financeiro / 2ª via de boleto → exige CNPJ ou razão social
  - Suporte ao app / senha → exige e-mail ou usuário
  - Bloqueio / desbloqueio de veículo → exige placa
  - Saudação sem assunto → resposta padrão acima
- Cada automação pode ser editada: nome, palavras-chave, texto de resposta, dados obrigatórios, fila de destino e se está ativa.
- Botão "Criar automação" para casos fora do catálogo.
- **Painel de perguntas mais frequentes**: lista as intenções mais detectadas no período, quantas o robô resolveu sozinho, quantas viraram chamado e quais mensagens a IA não conseguiu classificar — com botão para transformar essas em uma nova automação.

## Análise FMEA (riscos e proteções)

| Falha possível | Efeito | Proteção no projeto |
|---|---|---|
| Robô responde depois do operador | Cliente recebe duas respostas | Antes de enviar, confere se houve mensagem do operador nos últimos segundos; se houve, cancela |
| Robô responde duas vezes a mesma mensagem | Spam ao cliente | Registro de envio por conversa/mensagem e tempo mínimo entre respostas |
| Operador atribuído está inativo/offline | Nome errado no texto e chamado parado | Só escolhe operadores ativos e não "somente painel"; prefere online, e se ninguém estiver, usa o de menor carga |
| IA classifica errado | Resposta sem sentido | Palavra-chave tem prioridade; IA só age com confiança alta; tudo fica registrado e revisável no painel |
| IA indisponível ou sem créditos | Robô trava | Falha silenciosa: cai para o operador normalmente, sem mensagem de erro ao cliente |
| Cliente em grupo ou conversa já em andamento | Ruído | Robô limitado a conversas individuais e novas |
| Cliente responde fora do padrão (placa errada) | Dado inútil no chamado | Validação de formato de placa; se não bater, pede uma vez de forma explicada |
| WhatsApp lento no envio | Mensagem duplicada | Reaproveita a proteção de tempo limite já existente no envio |
| Cliente escreve fora do horário | Resposta fora de hora | Respeita o horário de atendimento já configurado |

## Sugestões de evolução

- **Transferência automática por assunto**: depois de alguns dias de uso, o painel mostra quais assuntos sempre acabam em determinada fila e permite ativar o roteamento direto.
- **Resumo do atendimento para o técnico**: cartão no topo do chamado com assunto, placa, período e histórico do cliente.
- **Reaproveitamento de dados**: se o cliente tem uma só placa cadastrada, o robô confirma em vez de perguntar.
- **Teste de mensagem**: campo na configuração para digitar uma frase e ver qual automação responderia, sem enviar nada ao cliente.
- **Relatório mensal do robô**: quanto tempo de operador foi economizado e quais perguntas mais se repetem.

## Detalhes técnicos

- Novas tabelas: `bot_auto_reply_settings` (singleton com tempos e horários), `bot_auto_reply_rules` (nome, palavras-chave, texto, campos exigidos, fila, ativo, origem catálogo), `bot_auto_reply_log` (chat, mensagem, regra, intenção IA, confiança, dados coletados, resultado) — todas com RLS e GRANT; leitura para autenticados, escrita para admin/gestor.
- Enfileiramento: ao receber inbound em `api.public.zapi-webhook.$channelId.tsx`, grava a intenção pendente e o horário-alvo; um scanner público (`api.public.bot-auto-reply-scanner.tsx`, no mesmo padrão do `chat-idle-scanner`) roda a cada ~10s e dispara os envios vencidos (saudação de 10s e cobrança de 10min). Isso evita segurar o webhook.
- Atribuição inicial: reutiliza `pick_least_loaded_agent` (online) com fallback `pick_least_loaded_agent_any`; nome do operador vem de `profiles.name`.
- Classificação por IA: server function com Lovable AI (`openai/gpt-6-astra`, saída estruturada com intenção + confiança), lista de intenções montada a partir das regras ativas. Erros 402/403/429 apenas registram e liberam para o operador.
- Envio usa `zapiSendText` (`src/lib/zapi.server.ts`) e grava em `zapi_messages` como as demais automações.
- UI: `src/components/configuracoes/bot-auto-reply-config.tsx` + rota `src/routes/configuracoes.robo-atendimento.tsx`, entrada em `menu-catalog.ts` e na barra lateral.
