
CREATE TABLE IF NOT EXISTS public.daily_welcome_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  show_quote boolean NOT NULL DEFAULT true,
  quote_source text NOT NULL DEFAULT 'ai',  -- 'ai' | 'manual'
  manual_quote text DEFAULT '',
  manual_quote_author text DEFAULT '',
  show_reminders boolean NOT NULL DEFAULT true,
  show_tickets boolean NOT NULL DEFAULT true,
  show_tasks boolean NOT NULL DEFAULT true,
  greeting_text text NOT NULL DEFAULT 'Bom dia',
  reset_hour smallint NOT NULL DEFAULT 0,  -- 0..23
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.daily_welcome_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view welcome settings"
  ON public.daily_welcome_settings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage welcome settings"
  ON public.daily_welcome_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

INSERT INTO public.daily_welcome_settings (is_enabled, show_quote, quote_source)
SELECT true, true, 'ai'
WHERE NOT EXISTS (SELECT 1 FROM public.daily_welcome_settings);
