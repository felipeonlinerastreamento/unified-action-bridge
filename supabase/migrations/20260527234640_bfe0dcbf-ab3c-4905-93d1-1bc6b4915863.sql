
CREATE TABLE public.ticket_subcategories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  category_key TEXT NOT NULL,
  category_label TEXT,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_subcategories_category_key ON public.ticket_subcategories(category_key);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_subcategories TO authenticated;
GRANT ALL ON public.ticket_subcategories TO service_role;

ALTER TABLE public.ticket_subcategories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view subcategories"
  ON public.ticket_subcategories FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Admins can insert subcategories"
  ON public.ticket_subcategories FOR INSERT
  TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subcategories"
  ON public.ticket_subcategories FOR UPDATE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subcategories"
  ON public.ticket_subcategories FOR DELETE
  TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_ticket_subcategories_updated_at
  BEFORE UPDATE ON public.ticket_subcategories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS subcategory_id UUID REFERENCES public.ticket_subcategories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS subcategory_name TEXT;

CREATE INDEX IF NOT EXISTS idx_service_tickets_subcategory_id ON public.service_tickets(subcategory_id);
