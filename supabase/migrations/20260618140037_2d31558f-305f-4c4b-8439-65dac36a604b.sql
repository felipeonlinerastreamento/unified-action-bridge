
CREATE TABLE public.company_shared_notes (
  company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
  content text NOT NULL DEFAULT '',
  updated_by uuid,
  updated_by_name text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_shared_notes TO authenticated;
GRANT ALL ON public.company_shared_notes TO service_role;

ALTER TABLE public.company_shared_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view shared notes" ON public.company_shared_notes
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users insert shared notes" ON public.company_shared_notes
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users update shared notes" ON public.company_shared_notes
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_company_shared_notes_updated_at
  BEFORE UPDATE ON public.company_shared_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
