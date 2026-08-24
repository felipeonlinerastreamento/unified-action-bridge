CREATE TABLE public.platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.platforms TO authenticated;
GRANT ALL ON public.platforms TO service_role;
ALTER TABLE public.platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view platforms" ON public.platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage platforms" ON public.platforms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON public.platforms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.company_platforms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  platform_id uuid NOT NULL REFERENCES public.platforms(id) ON DELETE CASCADE,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (company_id, platform_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_platforms TO authenticated;
GRANT ALL ON public.company_platforms TO service_role;
ALTER TABLE public.company_platforms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view company platforms" ON public.company_platforms FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage company platforms" ON public.company_platforms FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_company_platforms_updated_at BEFORE UPDATE ON public.company_platforms FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();