ALTER TABLE public.daily_motivational_quotes
  ADD COLUMN IF NOT EXISTS user_id UUID;

-- Remove restrição antiga (única por data) se existir
ALTER TABLE public.daily_motivational_quotes
  DROP CONSTRAINT IF EXISTS daily_motivational_quotes_quote_date_key;

-- Cria índice único composto (user_id, quote_date) — permite NULL user_id como global
CREATE UNIQUE INDEX IF NOT EXISTS daily_quotes_user_date_uniq
  ON public.daily_motivational_quotes (user_id, quote_date)
  WHERE user_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS daily_quotes_global_date_uniq
  ON public.daily_motivational_quotes (quote_date)
  WHERE user_id IS NULL;