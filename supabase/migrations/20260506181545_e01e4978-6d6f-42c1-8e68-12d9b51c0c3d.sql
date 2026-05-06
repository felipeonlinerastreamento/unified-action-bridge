-- Remove existing duplicates keeping the earliest row per (chat_id, zapi_message_id)
DELETE FROM public.zapi_messages a
USING public.zapi_messages b
WHERE a.zapi_message_id IS NOT NULL
  AND a.zapi_message_id = b.zapi_message_id
  AND a.chat_id = b.chat_id
  AND a.created_at > b.created_at;

-- Partial unique index so future webhook deliveries cannot insert duplicates
CREATE UNIQUE INDEX IF NOT EXISTS uniq_zapi_messages_chat_zapi_msg
  ON public.zapi_messages (chat_id, zapi_message_id)
  WHERE zapi_message_id IS NOT NULL;