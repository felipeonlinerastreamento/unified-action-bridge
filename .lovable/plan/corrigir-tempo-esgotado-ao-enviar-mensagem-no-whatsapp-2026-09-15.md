# Corrigir "tempo esgotado" ao enviar mensagem no WhatsApp

## O que está acontecendo

Ao enviar uma mensagem na Central de Atendimento, o sistema espera no máximo 8 segundos pela resposta do WhatsApp (Z-API). Se passar disso, ele desiste e mostra o erro "the operation was aborted due to timeout" — a mensagem não é registrada na conversa.

Esse limite de 8 segundos foi criado para outro cenário (o recebimento automático de mensagens, que precisa responder rápido). Ele acabou valendo também para o envio feito pelo operador, que pode demorar mais — principalmente com áudios, imagens e arquivos, que sobem o conteúdo inteiro na mesma chamada.

## O que será feito

1. **Tempo de espera por tipo de operação**
   - Envio feito pelo operador (texto): até 30 segundos.
   - Envio de áudio, imagem, vídeo e documento: até 60 segundos.
   - Rotinas automáticas de recebimento: continuam com o limite curto atual, para não travar o recebimento.

2. **Uma nova tentativa automática em falhas de rede**
   Se a chamada falhar por queda de conexão antes de chegar ao WhatsApp, o sistema tenta mais uma vez. Em caso de tempo esgotado no envio, **não** haverá nova tentativa automática, para não correr o risco de o cliente receber a mensagem duplicada.

3. **Mensagem de erro em português e clara**
   No lugar do texto técnico, o operador verá algo como: "O WhatsApp demorou demais para responder. A mensagem pode não ter sido entregue — confira a conversa antes de reenviar."

4. **Aviso de possível entrega**
   Quando o envio estourar o tempo, a tela pedirá a atualização da conversa, para que, se a mensagem tiver sido entregue mesmo assim, ela apareça sem duplicar.

## Detalhes técnicos

- `src/lib/zapi.server.ts`: `zapiFetch` passa a aceitar um parâmetro opcional de `timeoutMs` (padrão 8000, mantido para o webhook). `zapiSendText` usa 30000 e `zapiSendMedia` 60000. Erro de `AbortError`/`TimeoutError` é convertido em `Error("Tempo esgotado ao falar com o WhatsApp...")`; erro de rede sem resposta faz 1 retry.
- `src/lib/zapi.functions.ts` (`sendText` e as funções de mídia): repassam o erro tratado; nada muda no fluxo de gravação em `zapi_messages` nem na deduplicação por `zapi_message_id`.
- Front (Central de Atendimento e janela flutuante): no `onError` do envio, invalidar as consultas de mensagens do chat para trazer a mensagem caso ela tenha sido entregue.
- Sem alterações de banco de dados.
