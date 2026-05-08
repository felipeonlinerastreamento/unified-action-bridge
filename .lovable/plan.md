## Problema

A contato **Cecília Alves** está duplicado no chat:

| ID do chat | phone | Origem provável |
|---|---|---|
| `42199bff…` | `5527999598630` (real, E.164 BR) | mensagens recebidas/enviadas normais |
| `384e045e…` | `274611736428555` (15 dígitos, formato LID do WhatsApp) | eventos da Z-API que vieram com o LID em `phone` no lugar do número real (acontece em alguns SentCallback / casos de "notify sent by me") |

Ambos têm mensagens reais — então não é só visual, são duas linhas distintas em `zapi_chats` para o mesmo contato.

## Causa raiz

O webhook `src/routes/api.public.zapi-webhook.$channelId.tsx` faz `upsert` por `(channel_id, phone)` confiando cegamente em `p.phone`. Quando a Z-API envia um identificador LID (`@lid`, normalmente 15+ dígitos sem DDI 55), criamos um chat novo em vez de mesclar com o existente.

## Plano

### 1. Mesclar duplicatas existentes (migration de dados)
- Detectar pares no mesmo `channel_id` onde um `phone` é "real" (≤14 dígitos, começa com DDI) e outro é "LID-like" (15+ dígitos) e que compartilhem `contact_name`.
- Para cada par:
  - Mover todas as `zapi_messages` do chat LID para o chat real (`UPDATE chat_id`).
  - Reaproveitar `last_message_at` mais recente, somar `unread_count`.
  - Apagar o chat LID.
- Aplicar especificamente ao caso da Cecília (`384e045e…` → `42199bff…`) e a quaisquer outros pares encontrados.

### 2. Prevenir nova duplicação no webhook
Em `api.public.zapi-webhook.$channelId.tsx`, antes do upsert do chat:

- Se `phone` parecer um LID (tamanho > 14 dígitos **e** não for grupo `@g.us`/`<id>-<ts>`):
  - Tentar resolver para o telefone real consultando outros campos do payload (`p.participantPhone`, `p.senderPhone`, `p.chatPhone`) ou pelo `senderName` no mesmo `channel_id`.
  - Se encontrar um chat real correspondente → usar o chat existente (sem criar novo).
  - Se não encontrar → ignorar o evento e logar (`[zapi-webhook] dropping LID-only event`), em vez de criar um chat órfão.
- Manter o tratamento normal para grupos (que já é detectado por `isGroupPhoneIdentifier`).

### 3. Validação
- Conferir no painel que só existe um card "Cecília Alves" e que o histórico está completo (mensagens dos dois chats juntas, em ordem cronológica).
- Enviar uma nova mensagem pelo WhatsApp para reproduzir o cenário do SentCallback e confirmar que ela cai no chat existente, sem recriar o duplicado.

### Arquivos a alterar
- `supabase/migrations/<nova>.sql` — merge de dados (pontual + regra geral para LIDs órfãos).
- `src/routes/api.public.zapi-webhook.$channelId.tsx` — bloquear criação de chat por identificador LID.

Sem mudanças de UI.