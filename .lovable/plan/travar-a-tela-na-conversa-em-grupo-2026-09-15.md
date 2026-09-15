# Travar a tela na conversa em grupo

## O que eu verifiquei

A conversa em grupo "Chat" (criada por Felipe às 12:46) está correta no banco:

- Paulo e Derick estão marcados como bloqueados; Felipe (autor) não.
- Nenhum dos dois enviou mensagem ainda, então o bloqueio continua ativo no banco.
- As regras de acesso permitem que cada um enxergue a própria marcação de bloqueio.

Ou seja: o bloqueio foi gravado — o que falhou foi a tela dos dois não ter exibido o aviso obrigatório. O aviso só aparece enquanto a pessoa está com o sistema aberto e a tela consulta o bloqueio a cada 15 segundos, sem aviso sonoro e sem reação imediata quando o bloqueio chega. Quem estava com a aba aberta desde antes da atualização do sistema também não recebe a nova verificação sem recarregar a página.

Causa exata ainda não confirmada — o primeiro passo do trabalho é reproduzir o bloqueio entrando como Derick e observar a tela.

## O que vou fazer

1. **Reproduzir e confirmar** — entrar na aplicação como um dos operadores bloqueados e verificar se o aviso obrigatório aparece; corrigir o que estiver impedindo.
2. **Bloqueio imediato** — o aviso passa a chegar na hora (aviso em tempo real do bloqueio), além de nova verificação a cada 5 segundos e sempre que a pessoa volta para a aba.
3. **Aviso sonoro e visual** — ao ser bloqueado, tocar o mesmo som das notificações importantes, para que a pessoa perceba mesmo em outra janela.
4. **Conteúdo do aviso em grupo** — o modal mostra o assunto, quem enviou e os participantes, e só libera depois que a própria pessoa responde na conversa.
5. **Sinalização na lista** — o cadeado aparece também nas conversas em grupo, para cada participante ainda bloqueado.
6. **Validar** — checar de novo entrando como o operador: aviso aparece, não é possível fechar, e some assim que ele responde.

## Detalhes técnicos

- `operator-chat-lock-overlay.tsx`: assinatura realtime em `operator_chat_participants` filtrada por `user_id`, além do canal atual de `operator_chats`; `refetchInterval` 5s, `refetchOnWindowFocus`, e listener de `visibilitychange`.
- Som via `src/lib/notification-sounds.ts` disparado na transição de "sem bloqueio" para "bloqueado".
- `operator-chat-dialog.tsx`: quando `locked` e o chat é `is_group`, buscar `operator_chat_participants` para exibir nomes; após o envio, invalidar `operator-chat-locked`.
- `chat-operadores.tsx` / `operator-chat-list.tsx`: trazer `is_locked` da linha do participante para exibir o cadeado em grupos.
- Sem mudanças de banco: tabela, políticas e gatilho de desbloqueio já estão corretos.
- Observação: abas abertas antes da correção precisam ser recarregadas uma vez.
