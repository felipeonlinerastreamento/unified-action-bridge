CREATE TABLE public.crm_opportunity_quotes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  quote_number int NOT NULL,
  items jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_activation numeric NOT NULL DEFAULT 0,
  total_monthly numeric NOT NULL DEFAULT 0,
  notes text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_opportunity_quotes_opp ON public.crm_opportunity_quotes(opportunity_id, quote_number DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_opportunity_quotes TO authenticated;
GRANT ALL ON public.crm_opportunity_quotes TO service_role;

ALTER TABLE public.crm_opportunity_quotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view quotes" ON public.crm_opportunity_quotes
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert quotes" ON public.crm_opportunity_quotes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins/gestors can update quotes" ON public.crm_opportunity_quotes
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admins/gestors can delete quotes" ON public.crm_opportunity_quotes
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE OR REPLACE FUNCTION public.assign_crm_quote_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.quote_number IS NULL OR NEW.quote_number = 0 THEN
    SELECT COALESCE(MAX(quote_number), 0) + 1
      INTO NEW.quote_number
      FROM public.crm_opportunity_quotes
      WHERE opportunity_id = NEW.opportunity_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_assign_crm_quote_number
  BEFORE INSERT ON public.crm_opportunity_quotes
  FOR EACH ROW EXECUTE FUNCTION public.assign_crm_quote_number();

CREATE TRIGGER trg_crm_quotes_updated_at
  BEFORE UPDATE ON public.crm_opportunity_quotes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();