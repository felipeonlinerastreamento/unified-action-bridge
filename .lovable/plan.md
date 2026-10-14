# Corrigir erro "Falha de conexão com o WhatsApp" ao sincronizar

## Diagnóstico

- O canal "WhatsApp Principal" está configurado corretamente (instância, token e client-token presentes e ativos).
- Teste direto na Z-API agora retorna **conectado** (`connected: true`, celular online). Ou seja, o WhatsApp está funcionando.
- O erro "Falha de conexão com o WhatsApp. Tente novamente em instantes." aparece quando a chamada do nosso servidor até a Z-API falha por erro de rede momentâneo (não é problema de credencial nem de sessão).
- Hoje a verificação de status (`zapiGetStatus`) faz **uma única tentativa** e não usa o retry que já existe para envios — qualquer oscilação de rede vira "Desconectada" na tela.

## O que será feito

1. **Retry na verificação de status**
   - `zapiGetStatus` (e demais consultas de leitura: metadados de grupo, foto) passam a usar `retryOnNetworkError: true` — uma nova tentativa automática após ~800 ms quando a falha for de rede (sem resposta). Timeout continua sem retry.

2. **Mensagem mais clara na tela de configuração**
   - Quando o status vier como "Desconectada" por falha de rede, a tela mostra que pode ser instabilidade momentânea e sugere clicar em "Testar conexão" novamente, em vez de parecer que o WhatsApp caiu de fato.

3. **Sem alteração de banco de dados.**

## Detalhes técnicos

- `src/lib/zapi.server.ts`: `zapiGetStatus` passa `opts { retryOnNetworkError: true }` ao `zapiFetch`; o mecanismo de retry já existe e é usado hoje apenas nos envios.
- `src/components/configuracoes/zapi-connection-config.tsx`: ao exibir erro de conexão no badge de status, incluir orientação de re-tentativa (texto em PT-BR).
- Validação: `tsgo` + build; teste do botão "Testar conexão" na tela Z-API & Bot.

## Observação

Se o erro persistir mesmo após a correção, aí sim indicará queda real da Z-API ou da sessão do número — nesse caso o caminho é reconectar o número no painel da Z-API (QR Code).
