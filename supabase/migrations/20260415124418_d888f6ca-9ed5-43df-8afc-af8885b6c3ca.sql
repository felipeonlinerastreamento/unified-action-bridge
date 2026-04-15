
CREATE TABLE public.sectors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sectors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage sectors"
  ON public.sectors FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view sectors"
  ON public.sectors FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_sectors_updated_at
  BEFORE UPDATE ON public.sectors
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
