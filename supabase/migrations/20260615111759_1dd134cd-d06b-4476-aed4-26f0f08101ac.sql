CREATE TABLE public.purchase_item_types (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.purchase_item_types TO authenticated;
GRANT ALL ON public.purchase_item_types TO service_role;

ALTER TABLE public.purchase_item_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view types"
ON public.purchase_item_types FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins and gestores manage types"
ON public.purchase_item_types FOR ALL TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER trg_purchase_item_types_updated
BEFORE UPDATE ON public.purchase_item_types
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed existing hardcoded types
INSERT INTO public.purchase_item_types (name) VALUES
  ('suprimento'), ('equipamento'), ('chip'), ('outro')
ON CONFLICT (name) DO NOTHING;