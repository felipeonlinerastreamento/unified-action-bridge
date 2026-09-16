# Robô: não pedir dado que o cliente já enviou

## Comportamento hoje (verificado)

Na automação "Financeiro - Boletos e Cobranças" a resposta cadastrada é:

> Claro! Para enviar seu boleto ou verificar informações financeiras, por favor, nos informe o CPF/CNPJ.

O robô só reconhece a palavra-chave ("boleto", "cobrança", "valor", "pagamento") e envia esse texto **sempre**, sem olhar se o cliente já mandou o CPF. O campo "dados exigidos" (cpf_cnpj_ou_placa) hoje é apenas informativo: não muda nada no envio. O robô só sabe ler placa e período dentro da mensagem — CPF e CNPJ ele nem enxerga.

Ou seja, hoje: cliente escreve "preciso do boleto, meu CPF é 123.456.789-00" e mesmo assim recebe "nos informe o CPF/CNPJ". Fica repetitivo e o técnico continua sem o dado destacado.

## O que mudar

1. **Ler CPF e CNPJ na mensagem** (com ou sem pontos/traços), além de placa e período que já são lidos.
2. **Checar os dados exigidos antes de responder**: se tudo que a automação pede já veio na mensagem, o robô não repete o pedido.
3. **Duas respostas por automação**:
   - texto atual, usado quando falta dado;
   - texto de confirmação, usado quando o dado já veio. Ex.: "Perfeito! Já recebi o CPF/CNPJ 123.456.789-00. Vou verificar o boleto e já te retorno." Quando o gestor não preencher esse segundo texto, o robô fica em silêncio e passa direto para o operador (sem mensagem repetida).
4. **Guardar o dado na conversa**: CPF/CNPJ, placa e período coletados ficam registrados no histórico do robô e visíveis para o atendente, que é o objetivo do projeto.
5. Se faltar só parte (ex.: pede placa e período, veio só a placa), o robô pede apenas o que falta.

## Na tela de configuração

- Novo campo por automação: "Resposta quando o dado já veio".
- Os "dados exigidos" passam a ser escolhidos numa lista padronizada (CPF/CNPJ, placa, período, cidade, e-mail/usuário) em vez de texto livre, para o robô saber o que procurar.
- O testador de mensagem mostra qual automação respondeu, quais dados foram reconhecidos e qual dos dois textos seria enviado.

## Detalhes técnicos

- `src/lib/bot-auto-reply.server.ts`: novas funções `extractDocument` (CPF 11 dígitos / CNPJ 14 dígitos, com validação de dígito verificador para evitar falso positivo com número de pedido) e `missingRequiredFields(rule, collected)`; `evaluateInboundForAutoReply` grava `collected` normalizado (`cpf_cnpj`, `placa`, `periodo`) e escolhe entre `reply_text` e o novo `reply_text_complete`; quando não há texto de confirmação, registra log com `outcome: "skipped_data_complete"` e não agenda envio.
- Migração: coluna `reply_text_complete text` em `bot_auto_reply_rules` e normalização dos `required_fields` existentes para chaves canônicas.
- `bot-auto-reply-config.tsx`: campo do novo texto, seletor múltiplo de dados exigidos, exibição no testador.
