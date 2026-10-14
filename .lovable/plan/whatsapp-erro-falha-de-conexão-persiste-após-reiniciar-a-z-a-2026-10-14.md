# WhatsApp: erro "Falha de conexão" persiste após reiniciar a Z-API

## Diagnóstico
- A mensagem exibida ("Desconectada: Falha de conexão...") é o texto antigo; a melhoria anterior (nova tentativa automática + mensagem mais clara) só vale no site depois de publicar. Se você está usando o endereço publicado, ainda roda a versão antiga.
- Hoje o sistema esconde o motivo real da falha (só mostra "Falha de conexão"), então não dá para saber se é credencial, endereço da instância, token de segurança ou bloqueio de rede.

## O que será feito
1. Mostrar o motivo real: quando a chamada à Z-API falhar, guardar e exibir o detalhe técnico (ex.: recusa, endereço inválido, token incorreto) junto da mensagem em português.
2. Teste direto do servidor: executar o "Testar conexão" do próprio sistema para o canal configurado e conferir se as credenciais salvas (instância, token, token de segurança) batem com as da Z-API após o reinício — reiniciar às vezes gera novo token.
3. Aumentar o tempo de espera do teste de conexão para 15 s e fazer até 3 tentativas.
4. Pedir para publicar, para o site usar a versão corrigida.

## Detalhes técnicos
- `src/lib/zapi.server.ts`: no `catch` de `zapiFetch`, registrar `console.error` com `err.name/err.message/cause` e anexar o motivo à mensagem; `getStatus` com `timeoutMs: 15000` e 3 tentativas.
- `zapi-connection-config.tsx`: exibir o detalhe retornado.
- Conferir o canal em `channels` (sem expor tokens) e testar via chamada de servidor.
