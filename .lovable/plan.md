## Objetivo
Garantir, no nível do banco, que **nunca** existam dois chats em `zapi_chats` para o mesmo contato no mesmo canal — independentemente do código que tente inserir.

## 1. Função de normalização de telefone BR
`public.normalize_zapi_phone(raw text) returns text`:
- Remove tudo que não for dígito.
- Se identificador for grupo (`@g.us` no original ou >= 16 dígitos sem padrão BR) → retorna como está (grupos podem coexistir, não normalizamos).
- Se começar com `55` e tiver 12–13 dígitos → mantém.
- Se tiver 10–11 dígitos (sem DDI) → prefixa `55`.
- Se >= 15 dígitos sem ser grupo → trata como LID, retorna prefixo `lid:` + dígitos (para nunca colidir com telefone real).
- IMMUTABLE, usada em índice.

## 2. Coluna gerada + índices únicos parciais
- `ALTER TABLE zapi_chats ADD COLUMN phone_normalized text GENERATED ALWAYS AS (public.normalize_zapi_phone(phone)) STORED;`
- Índice único parcial 1 — telefone:
  `CREATE UNIQUE INDEX uniq_zapi_chats_channel_phone_norm ON zapi_chats(channel_id, phone_normalized) WHERE phone_normalized NOT LIKE 'lid:%';`
- Índice único parcial 2 — nome (apenas chats não-grupo, com nome):
  `CREATE UNIQUE INDEX uniq_zapi_chats_channel_contact_name ON zapi_chats(channel_id, lower(contact_name)) WHERE contact_name IS NOT NULL AND contact_name <> '' AND length(regexp_replace(phone, '\D','','g')) <= 14;`

## 3. Trigger `BEFORE INSERT`
`prevent_duplicate_zapi_chat()`:
- Se já existir chat no mesmo `channel_id` com mesmo `phone_normalized` (não-LID) → `RAISE EXCEPTION 'duplicate_zapi_chat:<id_existente>'`.
- Se já existir chat no mesmo `channel_id` com mesmo `lower(contact_name)` (e o novo não for grupo) → idem.
- Webhook captura a exceção, extrai o id e roteia a mensagem para o chat existente em vez de falhar.

## 4. Ajuste no webhook
Em `src/routes/api.public.zapi-webhook.$channelId.tsx`:
- Antes do upsert, normalizar `phone` com a mesma lógica do banco.
- No `catch` da inserção do chat, detectar o erro `duplicate_zapi_chat:<uuid>` → carregar esse chat e seguir o fluxo normal.

## 5. Pré-requisito: deduplicar antes de criar os índices
Os índices únicos vão falhar enquanto existirem duplicatas. Antes da migração de schema, rodar a limpeza:
- Para cada `(channel_id, phone_normalized)` ou `(channel_id, lower(contact_name))` com >1 chat (excluindo grupos e LIDs):
  - Canônico = chat mais antigo com mais mensagens.
  - Mover `zapi_messages` (descartando antes os duplicados por `zapi_message_id`), somar `unread_count`, manter `last_message_at` mais recente.
  - Deletar os outros.
- **Felipe e Natália preservados**: nomes iguais mas telefones reais distintos (sem padrão LID) — ficam separados; nesses casos só o índice de `contact_name` precisa de cuidado: vou usar `lower(contact_name) || '|' || phone_normalized` ou simplesmente NÃO criar o índice de nome, apenas o de telefone normalizado, e deixar o webhook fazer a checagem de nome só quando `phone` for LID.

  → Decisão: **manter apenas o índice único de `phone_normalized`** e tratar match-por-nome dentro do webhook (já existe). Isso evita falsos positivos para homônimos legítimos.

## Arquivos
- `supabase/migrations/<nova>.sql` — função, dedupe, coluna gerada, índice único, trigger.
- `src/routes/api.public.zapi-webhook.$channelId.tsx` — normalização e tratamento da exceção do trigger.

## Validação
- `SELECT channel_id, phone_normalized, COUNT(*) FROM zapi_chats GROUP BY 1,2 HAVING COUNT(*)>1` → vazio.
- Tentar `INSERT` manual de chat duplicado → falha com `duplicate_zapi_chat:<id>`.
- Enviar mensagem de teste por WhatsApp pelo celular do operador → cai no chat existente, sem criar duplicata.