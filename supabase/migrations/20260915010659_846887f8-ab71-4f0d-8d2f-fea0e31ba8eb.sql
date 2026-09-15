ALTER TABLE public.topgamific_ai_messages
  ADD COLUMN IF NOT EXISTS remote_conversation_id TEXT,
  ADD COLUMN IF NOT EXISTS remote_message_id TEXT;