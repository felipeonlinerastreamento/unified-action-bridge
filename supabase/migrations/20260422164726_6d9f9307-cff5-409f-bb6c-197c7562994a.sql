ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS sent_by_user_id uuid;

CREATE INDEX IF NOT EXISTS idx_zapi_messages_sent_by_user_id
  ON public.zapi_messages(sent_by_user_id);