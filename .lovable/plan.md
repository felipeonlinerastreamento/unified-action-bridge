# Corrigir erro ao enviar mensagem no WhatsApp (loop de redirecionamento)

## O que descobrimos
- O teste temporário, rodando no site publicado, consultou a Z-API **com sucesso** (resposta: conectado, celular online).
- Nesse mesmo momento, as chamadas normais do sistema, tanto o envio de mensagem quanto a checagem de status, receberam da Z-API um redirecionamento para o próprio endereço, repetido sem fim.
- A diferença entre as duas chamadas é a forma como o pedido é montado. O sistema sempre envia o cabeçalho "Content-Type: application/json", até em consultas sem conteúdo, e usa um limite de tempo. O teste não envia esse cabeçalho e funcionou. A causa mais provável é esse cabeçalho e o jeito como o pedido é montado, mas isso ainda **precisa ser confirmado**.

## O que será feito
1. **Confirmar a causa:** ampliar o teste temporário para comparar variações lado a lado no site publicado:
   - consulta de status com e sem o cabeçalho;
   - envio de teste para `/send-text` sem destinatário, que não manda mensagem a ninguém e só deve retornar "pedido inválido", com e sem o cabeçalho e com outras formas de enviar o corpo.
2. **Corrigir:** montar as chamadas à Z-API do jeito que funcionou no teste. Na prática, enviar o cabeçalho de conteúdo só quando houver corpo e repetir exatamente o formato que passou.
3. **Plano B:** se nenhuma variação funcionar a partir do servidor do site, a próxima opção é mover o envio para outro ponto de saída, como uma rotina já existente no backend, e informar o suporte da Z-API.
4. **Limpeza:** remover o teste temporário e os registros extras de redirecionamento depois de confirmar que o envio funciona.

## Para você
- Será preciso **publicar duas vezes**: uma para rodar o teste ampliado e outra para aplicar a correção. Posso juntar as duas etapas se o teste confirmar a causa.

## Detalhes técnicos
- `src/routes/api.public.zapi-debug.tsx`: adicionar variantes `GET /status` com `Content-Type: application/json`, com `AbortSignal.timeout` e sem. Também `POST /send-text` com body `{}`, com e sem `Content-Type`. Reportar status, `location` sanitizado e `cf-ray`.
- `src/lib/zapi.server.ts` (`zapiFetch`): definir `Content-Type` apenas quando `body` existir. Manter o follow manual de redirect com cookies como proteção.
- Depois de validar no site publicado, apagar a rota de debug e o `console.warn` por hop.
