
ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS maintenance_script text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS installation_script text NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS public.company_service_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_service_templates TO authenticated;
GRANT ALL ON public.company_service_templates TO service_role;

ALTER TABLE public.company_service_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view company service templates"
  ON public.company_service_templates FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert company service templates"
  ON public.company_service_templates FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update company service templates"
  ON public.company_service_templates FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete company service templates"
  ON public.company_service_templates FOR DELETE TO authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_company_service_templates_company
  ON public.company_service_templates(company_id);

CREATE TRIGGER trg_company_service_templates_updated_at
  BEFORE UPDATE ON public.company_service_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
