# Corrigir mensagem de inatividade duplicada na tela

O cliente recebe só 1 mensagem, mas a tela do chat mostra 2, porque o sistema não guarda o código da mensagem devolvido pelo WhatsApp e, quando a confirmação de entrega chega, cria uma segunda linha.

## O que muda
1. Ao enviar a mensagem de inatividade, guardar o código da mensagem devolvido pelo WhatsApp (igual ao robô e ao envio manual). A confirmação de entrega passa a atualizar a mesma linha, sem duplicar.
2. Apagar a linha duplicada da conversa da Sueilane.

Nada mais muda no fluxo da Inatividade.

## Detalhes técnicos
- `sendInactivityMessageOnce` em `src/routes/api.public.zapi-webhook.$channelId.tsx`: capturar o retorno de `zapiSendText` e gravar `zapi_message_id: res?.messageId || res?.id || res?.zaapId || null` no insert.
- Remover `zapi_messages` id `7b3a88c3-7cf9-4b72-9102-f6e16657c95a` (chat `e5a8e15e-0254-4011-bd5f-32d46539fbe9`), conferindo antes que é a cópia.
- Precisa publicar para valer.
