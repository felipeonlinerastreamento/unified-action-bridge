# Corrigir envio de WhatsApp (rota alternativa não estava sendo acionada)

## Causa confirmada (registros do site publicado, 12:18 de hoje)
- Todos os envios e checagens de status continuam caindo no loop de redirecionamento da Z-API (saindo do servidor em Confins/Brasil).
- A rota alternativa pelo banco foi criada para esses casos, mas **nunca é usada**: o sistema só a aciona quando o erro contém a palavra "redirect", e o nosso próprio erro diz "redirecion**ou**", que não contém essa palavra. Por isso o erro aparece direto.
- Renato provavelmente conseguiu porque o envio dele saiu por um servidor sem o problema naquele momento. Ou seja, foi sorte, não uma configuração diferente.

## Mudanças
1. Acionar a rota alternativa por um sinal fixo do loop (marcador interno), sem depender do texto da mensagem. Também aceitar "redirect" e "redirecion".
2. Ao detectar o loop, ir direto para a rota alternativa já na 1ª tentativa, sem esperar e sem repetir pelo caminho direto.
3. Se a rota alternativa também falhar, mostrar uma mensagem clara: "Envio pela rota alternativa falhou", com o detalhe.
4. Deixar de registrar um aviso para cada redirecionamento. Registrar uma linha só por envio e indicar qual rota foi usada.

## Depois de publicar
- Testar o envio com um usuário diferente de Renato.
- Conferir nos registros se a mensagem saiu pela rota alternativa.
- Remover o teste temporário do site.

## Detalhes técnicos
- `src/lib/zapi.server.ts`: criar `class ZapiRedirectLoopError`, lançada quando `!res` após os hops. No catch, a condição passa a ser `err instanceof ZapiRedirectLoopError || /redirec/i.test(msg)`, desde que `method !== "PUT"`.
- Envolver `zapiFetchViaBackend` em try/catch e lançar um erro em PT-BR.
- Remover a rota `src/routes/api/public/zapi-debug.ts` depois da confirmação.
