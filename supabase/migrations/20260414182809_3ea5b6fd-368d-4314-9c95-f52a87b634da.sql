
CREATE TABLE public.category_routing_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_key TEXT NOT NULL,
  category_label TEXT NOT NULL DEFAULT '',
  target_sector_name TEXT NOT NULL DEFAULT '',
  target_sector_id TEXT NOT NULL DEFAULT '',
  auto_create_ticket BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.category_routing_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage routing rules"
ON public.category_routing_rules
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view routing rules"
ON public.category_routing_rules
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_category_routing_rules_updated_at
BEFORE UPDATE ON public.category_routing_rules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
