UPDATE public.zapi_chats c
SET
  status = 'aguardando',
  bot_state = '{}'::jsonb,
  assigned_to = NULL,
  sector_name = NULL,
  updated_at = now()
WHERE c.status = 'finalizado'
  AND c.last_message_at > now() - interval '7 days'
  AND EXISTS (
    SELECT 1
    FROM public.zapi_messages m
    WHERE m.chat_id = c.id
      AND m.from_me = false
      AND m.created_at = (
        SELECT max(m2.created_at)
        FROM public.zapi_messages m2
        WHERE m2.chat_id = c.id
      )
  );