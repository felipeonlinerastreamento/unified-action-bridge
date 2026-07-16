CREATE UNIQUE INDEX IF NOT EXISTS zapi_messages_chat_msg_uniq
  ON public.zapi_messages (chat_id, zapi_message_id)
  WHERE zapi_message_id IS NOT NULL;