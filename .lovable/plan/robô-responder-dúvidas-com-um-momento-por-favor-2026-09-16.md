# Robô: responder dúvidas com "um momento, por favor"

## O que aconteceu nessa conversa

O cliente escreveu uma mensagem longa, dirigida ao Paulo, com vários itens (a, b, c). Dentro dela aparecia a palavra "Instalação". O robô procura as palavras-chave em qualquer pedaço do texto, encontrou "instalação" e disparou a resposta da automação de agendamento: "Perfeito! Para agendar a instalação, me informe a cidade e o período desejado." — que não tinha nada a ver com a pergunta.

Hoje o robô só tem dois caminhos: ou dispara o texto da automação que casou, ou fica em silêncio. Não existe um caminho para "não entendi / é dúvida".

## O que será feito

1. **Nova resposta para dúvidas**
   Quando a mensagem não for claramente um dos assuntos cadastrados, o robô responde apenas:
   "Um momento, por favor, que estou verificando."
   O texto fica editável na tela Configurações → Robô de Atendimento, com um botão para ligar/desligar.

2. **Quando o robô vai considerar "dúvida"**
   - A mensagem é longa ou tem vários pedidos numa só (listas, itens a/b/c, várias perguntas).
   - A mensagem casa com mais de um assunto ao mesmo tempo.
   - A mensagem não casa com nenhum assunto, mas é claramente uma pergunta ou pedido.
   Nesses casos, nada de texto pedindo placa, cidade ou CPF: só o "um momento".

3. **Menos casamentos errados**
   A busca das palavras-chave passa a exigir a palavra inteira (não um pedaço solto no meio de um texto longo), reduzindo disparos como o desta conversa.

4. **Continua valendo o resto**
   Horário de atendimento, limite de respostas por conversa, espera de 10 segundos e a atribuição automática ao operador seguem iguais. A resposta de dúvida também conta no limite, para o cliente não receber "um momento" várias vezes.

5. **Correção de duplicidade**
   Nessa conversa a resposta do robô ficou gravada duas vezes (a nossa cópia e o eco que o WhatsApp devolve). Será tratado para aparecer só uma vez no histórico.

## Detalhes técnicos

- `bot_auto_reply_settings`: novas colunas `fallback_enabled` (boolean, default true) e `fallback_text` (text, default "Um momento, por favor, que estou verificando."), com GRANTs já existentes na tabela.
- `src/lib/bot-auto-reply.server.ts`:
  - `matchRule` passa a casar por limite de palavra (regex com `\b` sobre o texto normalizado) e a devolver todas as regras que casaram, não só a primeira.
  - nova função `looksLikeOpenQuestion(text)`: sinaliza dúvida por tamanho (> ~180 caracteres), múltiplas linhas com marcadores/itens, mais de uma interrogação, ou mais de uma regra casada.
  - `evaluateInboundForAutoReply`: se for dúvida (ou se nada casou e o texto não é saudação/mídia), agenda o `fallback_text` em vez do texto da regra; registra `outcome: "fallback"` em `bot_auto_reply_log` com as regras candidatas.
- `src/components/configuracoes/bot-auto-reply-config.tsx`: switch + textarea para a resposta de dúvida; testador mostra quando o resultado é a resposta de dúvida.
- Duplicidade: na persistência do envio do robô, gravar o `zapi_message_id` retornado pela Z-API para que o eco do webhook seja deduplicado pelo índice de `zapi_message_id`.
