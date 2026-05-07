## Objetivo

Na lista lateral de conversas (`chat-queue-list.tsx`), quando a **última mensagem da conversa for do cliente** (não do operador), o nome do contato deve ficar **em negrito e piscando** até que o operador envie uma resposta.

## Como detectar

O componente já tem a informação pronta:

- `chat.lastMessage?.sender?.isMe` → `false` quando o cliente é o último a falar
- `hasLastMsg` → garante que existe ao menos uma mensagem

Condição de destaque:
```ts
const clientWaiting = hasLastMsg && lastMsgIsMe === false;
```

Quando o operador enviar uma mensagem, o realtime (`useZapiRealtime`) já invalida `all-open-chats`, o `lastMessage.sender.isMe` vira `true`, e o destaque some automaticamente — sem lógica adicional.

## Mudanças

### 1. `src/styles.css` — adicionar animação
Nova keyframe `pulse-name` (opacidade 1 → 0.35 → 1, ~1.4s, infinita) e classe utilitária `.animate-name-blink`. Usar `@keyframes` puro, respeitando `prefers-reduced-motion` (desativa o blink).

### 2. `src/components/central/chat-queue-list.tsx` (linhas ~339-341)
Aplicar `font-bold` + `animate-name-blink` ao `<p>` do nome quando `clientWaiting`:

```tsx
<p
  className={`text-sm truncate ${clientWaiting ? "font-bold animate-name-blink" : "font-medium"}`}
  style={{ color: sla.bg }}
>
  {name}
</p>
```

(Opcional, mesma linha: também aumentar peso do badge `unread` quando `clientWaiting`.)

## Modo simulação antes de aplicar

Sim, dá pra simular sem mexer na lógica de detecção. Proposta: adicionar um **toggle temporário "Simular cliente aguardando"** no topo da lista (apenas para admin) que força `clientWaiting = true` em todas as linhas. Você visualiza o efeito em todas as conversas, valida o ritmo do piscar / negrito, e aí removemos o toggle e mantemos só a lógica real.

Alternativa mais leve: aplico direto e você confere ao vivo numa conversa onde o cliente foi o último a falar (e desligamos depois se não gostar).

## Itens fora do escopo

- Não muda backend, schema, RLS ou realtime.
- Não altera janelas flutuantes (`floating-chats-layer`) — se quiser o mesmo efeito no dock minimizado depois, é trivial replicar.
- Não toca em som/notificação — só visual.

## Pergunta antes de implementar

Qual das duas opções de simulação você prefere?
1. Toggle "Simular cliente aguardando" temporário na lista
2. Aplicar direto e ajustar ao vivo (intensidade do piscar / velocidade)
