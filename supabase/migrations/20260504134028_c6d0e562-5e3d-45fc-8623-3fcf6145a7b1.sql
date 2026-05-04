ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS reply_to_message_id uuid REFERENCES public.zapi_messages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS reply_to_text text,
  ADD COLUMN IF NOT EXISTS reply_to_author text;

CREATE INDEX IF NOT EXISTS idx_zapi_messages_reply_to ON public.zapi_messages(reply_to_message_id);