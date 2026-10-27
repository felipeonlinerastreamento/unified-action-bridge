CREATE TABLE public.ticket_assignment_alert_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled boolean NOT NULL DEFAULT true,
  on_created boolean NOT NULL DEFAULT true,
  on_reassigned boolean NOT NULL DEFAULT true,
  on_email boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT true,
  scope text NOT NULL DEFAULT 'all',
  user_ids uuid[] NOT NULL DEFAULT '{}',
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.ticket_assignment_alert_settings TO authenticated;
GRANT ALL ON public.ticket_assignment_alert_settings TO service_role;
ALTER TABLE public.ticket_assignment_alert_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read settings" ON public.ticket_assignment_alert_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "manage settings ins" ON public.ticket_assignment_alert_settings FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "manage settings upd" ON public.ticket_assignment_alert_settings FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
INSERT INTO public.ticket_assignment_alert_settings (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE public.ticket_assignment_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  target_user_id uuid NOT NULL,
  event_type text NOT NULL,
  triggered_by uuid,
  triggered_by_name text,
  protocol text,
  client_name text,
  subject text,
  created_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);
CREATE INDEX ON public.ticket_assignment_alerts (target_user_id) WHERE acknowledged_at IS NULL;
CREATE INDEX ON public.ticket_assignment_alerts (created_at);
GRANT SELECT, UPDATE ON public.ticket_assignment_alerts TO authenticated;
GRANT ALL ON public.ticket_assignment_alerts TO service_role;
ALTER TABLE public.ticket_assignment_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own or managers read" ON public.ticket_assignment_alerts FOR SELECT TO authenticated
  USING (target_user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "own ack" ON public.ticket_assignment_alerts FOR UPDATE TO authenticated
  USING (target_user_id = auth.uid()) WITH CHECK (target_user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.create_ticket_assignment_alert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  s public.ticket_assignment_alert_settings;
  ev text;
  actor uuid := auth.uid();
  actor_name text;
  company text;
BEGIN
  IF NEW.assigned_to IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.assigned_to IS NOT DISTINCT FROM NEW.assigned_to THEN RETURN NEW; END IF;
  IF actor IS NOT NULL AND actor = NEW.assigned_to THEN RETURN NEW; END IF;
  SELECT * INTO s FROM public.ticket_assignment_alert_settings WHERE id = 1;
  IF s IS NULL OR NOT s.enabled THEN RETURN NEW; END IF;
  IF s.scope = 'selected' AND NOT (NEW.assigned_to = ANY(s.user_ids)) THEN RETURN NEW; END IF;

  IF COALESCE(NEW.attendance_id,'') LIKE 'EM-%' THEN ev := 'email';
  ELSIF TG_OP = 'INSERT' THEN ev := 'created';
  ELSE ev := 'reassigned'; END IF;

  IF (ev='email' AND NOT s.on_email) OR (ev='created' AND NOT s.on_created) OR (ev='reassigned' AND NOT s.on_reassigned) THEN
    RETURN NEW;
  END IF;

  IF actor IS NOT NULL THEN SELECT name INTO actor_name FROM public.profiles WHERE user_id = actor LIMIT 1; END IF;
  IF NEW.company_id IS NOT NULL THEN SELECT name INTO company FROM public.companies WHERE id = NEW.company_id; END IF;

  INSERT INTO public.ticket_assignment_alerts (ticket_id, target_user_id, event_type, triggered_by, triggered_by_name, protocol, client_name, subject)
  VALUES (NEW.id, NEW.assigned_to, ev, actor,
    CASE WHEN actor IS NULL THEN 'Sistema / E-mail' ELSE COALESCE(actor_name,'Usuário') END,
    COALESCE(NEW.attendance_id, '#' || NEW.protocol_number::text),
    COALESCE(company, NEW.contact_name), NEW.category);
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END $$;

CREATE TRIGGER trg_ticket_assignment_alert
AFTER INSERT OR UPDATE OF assigned_to ON public.service_tickets
FOR EACH ROW EXECUTE FUNCTION public.create_ticket_assignment_alert();

ALTER PUBLICATION supabase_realtime ADD TABLE public.ticket_assignment_alerts;