
-- Catalog of releasable items (managed in Settings)
CREATE TABLE IF NOT EXISTS public.liberacao_equipamento_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.liberacao_equipamento_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view liberacao items"
  ON public.liberacao_equipamento_items FOR SELECT
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage liberacao items"
  ON public.liberacao_equipamento_items FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_liberacao_items_updated_at
  BEFORE UPDATE ON public.liberacao_equipamento_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Items linked to a service ticket
CREATE TABLE IF NOT EXISTS public.ticket_liberacao_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.liberacao_equipamento_items(id) ON DELETE SET NULL,
  item_name text NOT NULL,
  quantity integer NOT NULL DEFAULT 1 CHECK (quantity > 0),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente','liberado')),
  liberado_at timestamptz,
  liberado_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_liberacao_items_ticket ON public.ticket_liberacao_items(ticket_id);

ALTER TABLE public.ticket_liberacao_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket liberacao items"
  ON public.ticket_liberacao_items FOR SELECT
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert ticket liberacao items"
  ON public.ticket_liberacao_items FOR INSERT
  TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users update ticket liberacao items"
  ON public.ticket_liberacao_items FOR UPDATE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users delete ticket liberacao items"
  ON public.ticket_liberacao_items FOR DELETE
  TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TRIGGER trg_ticket_liberacao_items_updated_at
  BEFORE UPDATE ON public.ticket_liberacao_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Single release date per ticket
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS liberacao_date timestamptz;
