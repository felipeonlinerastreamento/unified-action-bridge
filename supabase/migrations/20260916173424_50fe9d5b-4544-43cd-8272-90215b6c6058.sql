ALTER TABLE public.bot_auto_reply_settings
  ADD COLUMN IF NOT EXISTS ai_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ai_min_confidence numeric NOT NULL DEFAULT 0.6;