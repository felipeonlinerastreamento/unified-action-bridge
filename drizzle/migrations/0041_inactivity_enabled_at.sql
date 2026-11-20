ALTER TABLE public.inactivity_message_settings ADD COLUMN IF NOT EXISTS enabled_at timestamptz;
UPDATE public.inactivity_message_settings SET enabled_at = now() WHERE is_enabled AND enabled_at IS NULL;
CREATE OR REPLACE FUNCTION public.inactivity_set_enabled_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF NEW.is_enabled AND (TG_OP = 'INSERT' OR NOT OLD.is_enabled) THEN
    NEW.enabled_at := now();
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_inactivity_set_enabled_at ON public.inactivity_message_settings;
CREATE TRIGGER trg_inactivity_set_enabled_at BEFORE INSERT OR UPDATE ON public.inactivity_message_settings
  FOR EACH ROW EXECUTE FUNCTION public.inactivity_set_enabled_at();