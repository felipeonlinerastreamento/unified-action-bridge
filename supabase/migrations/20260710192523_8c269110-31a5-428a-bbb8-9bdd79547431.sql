
CREATE TABLE public.chat_tag_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  color text NOT NULL DEFAULT '#a78bfa',
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_tag_catalog TO authenticated;
GRANT ALL ON public.chat_tag_catalog TO service_role;

ALTER TABLE public.chat_tag_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read tag catalog"
  ON public.chat_tag_catalog FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admin/gestor can manage tag catalog"
  ON public.chat_tag_catalog FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_chat_tag_catalog_updated_at
  BEFORE UPDATE ON public.chat_tag_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
