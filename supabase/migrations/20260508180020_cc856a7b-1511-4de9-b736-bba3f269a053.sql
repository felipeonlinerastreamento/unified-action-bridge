
-- =============================================================================
-- Unified Purchase Request module
-- =============================================================================

-- 1. Catálogo unificado de itens
CREATE TABLE IF NOT EXISTS public.purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  default_quantity INTEGER NOT NULL DEFAULT 1,
  item_type TEXT, -- 'suprimento' | 'equipamento' | 'chip' | NULL
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_items_name_lower ON public.purchase_items (lower(name));

ALTER TABLE public.purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_items_select" ON public.purchase_items
FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_items_manage" ON public.purchase_items
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_purchase_items_updated_at
BEFORE UPDATE ON public.purchase_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Fornecedores
CREATE TABLE IF NOT EXISTS public.purchase_suppliers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  cnpj TEXT,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_suppliers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_suppliers_select" ON public.purchase_suppliers
FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_suppliers_manage" ON public.purchase_suppliers
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_purchase_suppliers_updated_at
BEFORE UPDATE ON public.purchase_suppliers
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Contatos do fornecedor
CREATE TABLE IF NOT EXISTS public.purchase_supplier_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  supplier_id UUID NOT NULL REFERENCES public.purchase_suppliers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_purchase_supplier_contacts_supplier ON public.purchase_supplier_contacts(supplier_id);

ALTER TABLE public.purchase_supplier_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_supplier_contacts_select" ON public.purchase_supplier_contacts
FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_supplier_contacts_manage" ON public.purchase_supplier_contacts
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 4. Cabeçalho de solicitação por ticket
CREATE TABLE IF NOT EXISTS public.ticket_purchase_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL UNIQUE,
  supplier_id UUID REFERENCES public.purchase_suppliers(id) ON DELETE SET NULL,
  supplier_contact_id UUID REFERENCES public.purchase_supplier_contacts(id) ON DELETE SET NULL,
  freight NUMERIC(12,2) NOT NULL DEFAULT 0,
  tracking_code TEXT,
  expected_delivery DATE,
  seller_contact TEXT,
  status TEXT NOT NULL DEFAULT 'solicitado', -- solicitado | cotacao | comprado | em_transporte | entregue
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_purchase_requests_ticket ON public.ticket_purchase_requests(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchase_requests_supplier ON public.ticket_purchase_requests(supplier_id);

ALTER TABLE public.ticket_purchase_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_purchase_requests_all" ON public.ticket_purchase_requests
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_ticket_purchase_requests_updated_at
BEFORE UPDATE ON public.ticket_purchase_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Itens da solicitação
CREATE TABLE IF NOT EXISTS public.ticket_purchase_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL,
  request_id UUID REFERENCES public.ticket_purchase_requests(id) ON DELETE CASCADE,
  item_id UUID,
  item_name TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pendente', -- pendente | comprado | entregue
  delivered_at TIMESTAMPTZ,
  delivered_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_ticket_purchase_items_ticket ON public.ticket_purchase_items(ticket_id);
CREATE INDEX IF NOT EXISTS idx_ticket_purchase_items_item ON public.ticket_purchase_items(item_id);

ALTER TABLE public.ticket_purchase_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_purchase_items_all" ON public.ticket_purchase_items
FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE TRIGGER update_ticket_purchase_items_updated_at
BEFORE UPDATE ON public.ticket_purchase_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Configuração do fluxo (linha única)
CREATE TABLE IF NOT EXISTS public.purchase_flow_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  show_unit_price BOOLEAN NOT NULL DEFAULT true,
  show_freight BOOLEAN NOT NULL DEFAULT true,
  show_supplier BOOLEAN NOT NULL DEFAULT true,
  show_tracking BOOLEAN NOT NULL DEFAULT true,
  show_expected_delivery BOOLEAN NOT NULL DEFAULT true,
  show_seller_contact BOOLEAN NOT NULL DEFAULT true,
  require_unit_price BOOLEAN NOT NULL DEFAULT false,
  require_supplier BOOLEAN NOT NULL DEFAULT false,
  require_tracking BOOLEAN NOT NULL DEFAULT false,
  require_expected_delivery BOOLEAN NOT NULL DEFAULT false,
  price_variation_threshold NUMERIC(5,2) NOT NULL DEFAULT 10.00, -- percentual
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.purchase_flow_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "purchase_flow_config_select" ON public.purchase_flow_config
FOR SELECT TO authenticated USING (true);

CREATE POLICY "purchase_flow_config_manage" ON public.purchase_flow_config
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER update_purchase_flow_config_updated_at
BEFORE UPDATE ON public.purchase_flow_config
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.purchase_flow_config DEFAULT VALUES
ON CONFLICT DO NOTHING;

-- 7. Migração de dados de Suprimento → purchase_items
INSERT INTO public.purchase_items (name, default_quantity, item_type, is_active)
SELECT s.name, MAX(s.default_quantity), 'suprimento', bool_or(s.is_active)
FROM public.suprimento_items s
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_items pi WHERE lower(pi.name) = lower(s.name)
)
GROUP BY s.name;

-- 8. Migração de dados de Equipamento/Chip → purchase_items
INSERT INTO public.purchase_items (name, default_quantity, item_type, is_active)
SELECT c.name, MAX(c.default_quantity), 'equipamento', bool_or(c.is_active)
FROM public.compra_equipamento_items c
WHERE NOT EXISTS (
  SELECT 1 FROM public.purchase_items pi WHERE lower(pi.name) = lower(c.name)
)
GROUP BY c.name;

-- 9. Migração de itens de tickets antigos → ticket_purchase_items
INSERT INTO public.ticket_purchase_items (ticket_id, item_id, item_name, quantity, unit_price, status, delivered_at, delivered_by, created_at)
SELECT
  ts.ticket_id,
  (SELECT pi.id FROM public.purchase_items pi WHERE lower(pi.name) = lower(ts.item_name) LIMIT 1),
  ts.item_name,
  ts.quantity,
  0,
  ts.status,
  ts.delivered_at,
  ts.delivered_by,
  ts.created_at
FROM public.ticket_suprimento_items ts
WHERE NOT EXISTS (
  SELECT 1 FROM public.ticket_purchase_items tpi
  WHERE tpi.ticket_id = ts.ticket_id AND tpi.item_name = ts.item_name AND tpi.created_at = ts.created_at
);

INSERT INTO public.ticket_purchase_items (ticket_id, item_id, item_name, quantity, unit_price, status, delivered_at, delivered_by, created_at)
SELECT
  tc.ticket_id,
  (SELECT pi.id FROM public.purchase_items pi WHERE lower(pi.name) = lower(tc.item_name) LIMIT 1),
  tc.item_name,
  tc.quantity,
  0,
  tc.status,
  tc.delivered_at,
  tc.delivered_by,
  tc.created_at
FROM public.ticket_compra_equipamento_items tc
WHERE NOT EXISTS (
  SELECT 1 FROM public.ticket_purchase_items tpi
  WHERE tpi.ticket_id = tc.ticket_id AND tpi.item_name = tc.item_name AND tpi.created_at = tc.created_at
);

-- 10. View de histórico de compras por item
CREATE OR REPLACE VIEW public.v_purchase_item_history AS
SELECT
  tpi.id,
  tpi.ticket_id,
  tpi.item_id,
  tpi.item_name,
  tpi.quantity,
  tpi.unit_price,
  tpi.status,
  tpi.created_at,
  tpr.supplier_id,
  ps.name AS supplier_name
FROM public.ticket_purchase_items tpi
LEFT JOIN public.ticket_purchase_requests tpr ON tpr.ticket_id = tpi.ticket_id
LEFT JOIN public.purchase_suppliers ps ON ps.id = tpr.supplier_id
WHERE tpi.unit_price > 0;
