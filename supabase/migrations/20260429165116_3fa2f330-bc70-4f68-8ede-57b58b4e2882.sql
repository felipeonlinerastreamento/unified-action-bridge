
CREATE TABLE IF NOT EXISTS public.daily_motivational_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  quote_date date NOT NULL UNIQUE,
  content text NOT NULL,
  author text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_quotes_date ON public.daily_motivational_quotes(quote_date DESC);

ALTER TABLE public.daily_motivational_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view daily quotes"
  ON public.daily_motivational_quotes FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert daily quotes"
  ON public.daily_motivational_quotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);
