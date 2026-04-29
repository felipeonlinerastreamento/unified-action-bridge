
-- Catálogo de itens de suprimento (compra)
CREATE TABLE IF NOT EXISTS public.suprimento_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.suprimento_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view suprimento items"
ON public.suprimento_items FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage suprimento items"
ON public.suprimento_items FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_suprimento_items_updated_at
BEFORE UPDATE ON public.suprimento_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Itens de suprimento por ticket
CREATE TABLE IF NOT EXISTS public.ticket_suprimento_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | comprado | entregue
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_suprimento_items_ticket ON public.ticket_suprimento_items(ticket_id);

ALTER TABLE public.ticket_suprimento_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket suprimento items"
ON public.ticket_suprimento_items FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users manage ticket suprimento items"
ON public.ticket_suprimento_items FOR ALL TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

CREATE TRIGGER update_ticket_suprimento_items_updated_at
BEFORE UPDATE ON public.ticket_suprimento_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
