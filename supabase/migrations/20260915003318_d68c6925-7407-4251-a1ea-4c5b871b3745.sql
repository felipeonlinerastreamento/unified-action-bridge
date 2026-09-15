ALTER TABLE public.topgamific_ai_messages
  ADD COLUMN IF NOT EXISTS rating SMALLINT CHECK (rating IN (-1, 1)),
  ADD COLUMN IF NOT EXISTS rating_comment TEXT,
  ADD COLUMN IF NOT EXISTS rated_at TIMESTAMPTZ;