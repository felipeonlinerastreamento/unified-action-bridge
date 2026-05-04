-- Catalog of equipment/chip purchase items
CREATE TABLE IF NOT EXISTS public.compra_equipamento_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.compra_equipamento_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "compra_equip_catalog_select" ON public.compra_equipamento_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "compra_equip_catalog_manage" ON public.compra_equipamento_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_compra_equipamento_items_updated_at
BEFORE UPDATE ON public.compra_equipamento_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Ticket-linked items
CREATE TABLE IF NOT EXISTS public.ticket_compra_equipamento_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  status TEXT NOT NULL DEFAULT 'pendente',
  delivered_at TIMESTAMPTZ,
  delivered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_compra_equip_items_ticket
  ON public.ticket_compra_equipamento_items(ticket_id);

ALTER TABLE public.ticket_compra_equipamento_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_compra_equip_select" ON public.ticket_compra_equipamento_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "ticket_compra_equip_manage" ON public.ticket_compra_equipamento_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_ticket_compra_equipamento_items_updated_at
BEFORE UPDATE ON public.ticket_compra_equipamento_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();