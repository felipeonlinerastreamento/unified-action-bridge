
-- Catálogo de atividades do chamado
CREATE TABLE public.ticket_activity_catalog (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_activity_catalog TO authenticated;
GRANT ALL ON public.ticket_activity_catalog TO service_role;

ALTER TABLE public.ticket_activity_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Catalog readable by authenticated"
  ON public.ticket_activity_catalog FOR SELECT TO authenticated USING (true);

CREATE POLICY "Catalog insert admin"
  ON public.ticket_activity_catalog FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Catalog update admin"
  ON public.ticket_activity_catalog FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Catalog delete admin"
  ON public.ticket_activity_catalog FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ticket_activity_catalog_updated
  BEFORE UPDATE ON public.ticket_activity_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Atividades vinculadas a um chamado
CREATE TABLE public.ticket_activities (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  catalog_id UUID REFERENCES public.ticket_activity_catalog(id) ON DELETE SET NULL,
  name_snapshot TEXT NOT NULL,
  description_snapshot TEXT,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completion_note TEXT,
  completed_at TIMESTAMPTZ,
  completed_by UUID,
  added_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ticket_activities_ticket ON public.ticket_activities(ticket_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_activities TO authenticated;
GRANT ALL ON public.ticket_activities TO service_role;

ALTER TABLE public.ticket_activities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Activities readable by authenticated"
  ON public.ticket_activities FOR SELECT TO authenticated USING (true);

CREATE POLICY "Activities insert by authenticated"
  ON public.ticket_activities FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Activities update by authenticated"
  ON public.ticket_activities FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Activities delete admin only"
  ON public.ticket_activities FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_ticket_activities_updated
  BEFORE UPDATE ON public.ticket_activities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
