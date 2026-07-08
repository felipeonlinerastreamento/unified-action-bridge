
CREATE TABLE public.crm_opportunity_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  position int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_opportunity_types TO authenticated;
GRANT ALL ON public.crm_opportunity_types TO service_role;
ALTER TABLE public.crm_opportunity_types ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can view opp types" ON public.crm_opportunity_types FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage opp types" ON public.crm_opportunity_types FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER update_crm_opportunity_types_updated_at BEFORE UPDATE ON public.crm_opportunity_types FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crm_opportunity_types (name, position) VALUES
  ('Nova venda', 1),
  ('Upsell', 2),
  ('Renovação', 3),
  ('Recuperação', 4)
ON CONFLICT (name) DO NOTHING;
