ALTER TABLE public.bot_auto_reply_settings
  ADD COLUMN IF NOT EXISTS fallback_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS fallback_text text NOT NULL DEFAULT 'Um momento, por favor, que estou verificando.';