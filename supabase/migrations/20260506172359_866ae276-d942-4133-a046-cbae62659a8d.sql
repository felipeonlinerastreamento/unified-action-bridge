
CREATE TABLE public.perdidos_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  default_unit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.perdidos_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "perdidos_items_select_auth"
ON public.perdidos_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "perdidos_items_insert_admin_gestor"
ON public.perdidos_items FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "perdidos_items_update_admin_gestor"
ON public.perdidos_items FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "perdidos_items_delete_admin_gestor"
ON public.perdidos_items FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_perdidos_items_updated_at
BEFORE UPDATE ON public.perdidos_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.ticket_perdidos_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  item_id UUID REFERENCES public.perdidos_items(id) ON DELETE SET NULL,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_value NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_value) STORED,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID
);

CREATE INDEX idx_ticket_perdidos_items_ticket ON public.ticket_perdidos_items(ticket_id);
CREATE INDEX idx_ticket_perdidos_items_item ON public.ticket_perdidos_items(item_id);

ALTER TABLE public.ticket_perdidos_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_perdidos_items_select_auth"
ON public.ticket_perdidos_items FOR SELECT TO authenticated USING (true);

CREATE POLICY "ticket_perdidos_items_insert_auth"
ON public.ticket_perdidos_items FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "ticket_perdidos_items_update_auth"
ON public.ticket_perdidos_items FOR UPDATE TO authenticated USING (true);

CREATE POLICY "ticket_perdidos_items_delete_auth"
ON public.ticket_perdidos_items FOR DELETE TO authenticated USING (true);
