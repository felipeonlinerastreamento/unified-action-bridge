## Diagnóstico

O número `5531994730315` aparece em 3 chats distintos no banco:

| phone | phone_normalized | status |
|---|---|---|
| `5531994730315` (13 díg, com 9) | `5531994730315` | em_atendimento |
| `553194730315` (12 díg, **sem o 9**) | `553194730315` | aguardando |
| `lid:5531947303151592946780` (LID do WhatsApp) | `lid:...` | finalizado |

**Causa raiz:** a função `normalize_zapi_phone` (SQL) e o normalizador do webhook aceitam tanto `^55\d{10}$` (12 díg) quanto `^55\d{11}$` (13 díg) como canônicos, sem inserir o "9" obrigatório de celular brasileiro. Resultado: o mesmo celular pode ter dois `phone_normalized` diferentes — e o índice único `(channel_id, phone_normalized)` não detecta a duplicata. A migração anterior de dedupe só fundiu chats que já compartilhavam o mesmo canônico, então não resolveu este caso.

A função `zapiRecipientPhone` (envio) já insere o 9 corretamente — só a normalização de entrada/armazenamento estava inconsistente.

## O que será feito

### 1. Corrigir `normalize_zapi_phone` (migration)

Para celulares BR de 12 dígitos no formato `55 + DDD + 8 dígitos começando com 6-9`, inserir o "9" para virar 13 dígitos canônicos. Fixos (DDD + 8 começando com 2-5) continuam como estão.

```text
55 DD 6XXXXXXX  →  55 DD 9 6XXXXXXX
55 DD 7XXXXXXX  →  55 DD 9 7XXXXXXX
55 DD 8XXXXXXX  →  55 DD 9 8XXXXXXX
55 DD 9XXXXXXX  →  55 DD 9 9XXXXXXX
```

### 2. Espelhar a regra no webhook

Em `src/routes/api.public.zapi-webhook.$channelId.tsx` (bloco de normalização ~linhas 386–399), aplicar o mesmo "inserir 9" antes de gravar/buscar o chat. Garante que mensagens novas nunca mais criem o registro de 12 dígitos.

### 3. Re-executar dedupe

Como o `phone_normalized` é coluna gerada (`STORED`), atualizar a função recalcula automaticamente para todas as linhas. Em seguida, rodar o mesmo loop de fusão da migração `20260513195004_…` para juntar os chats que agora compartilham o mesmo canônico:

- Mantém o chat com mais mensagens (desempate: `last_message_at`).
- Migra `zapi_messages`, `attendance_event_logs`, `chat_idle_auto_message_logs`, `chat_inactivity_alert_logs`, `csat_pending`, `csat_responses`, `message_trigger_logs`, `out_of_hours_message_log` para o chat mantido.
- Soma `unread_count` e usa o `last_message_at` mais recente.
- Remove os chats duplicados.

### 4. Caso específico do `lid:`

Identificadores LID do WhatsApp não têm como ser fundidos automaticamente sem mapeamento explícito (chat já está finalizado neste caso). Não vamos tentar adivinhar — fica fora do escopo.

## Arquivos afetados

- Nova migração SQL: atualiza `normalize_zapi_phone` + roda dedupe.
- `src/routes/api.public.zapi-webhook.$channelId.tsx`: ajuste no normalizador inline (~10 linhas).

Nenhuma mudança de UI.

## Resultado esperado

Após a migração, o número `5531994730315` terá apenas 1 chat ativo no canal, mensagens consolidadas, e novos eventos do mesmo número (em qualquer formato 12/13 dígitos) sempre cairão no mesmo registro.
