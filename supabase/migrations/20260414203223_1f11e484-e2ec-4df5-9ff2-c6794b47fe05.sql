
CREATE TABLE public.ticket_agents (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid DEFAULT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(ticket_id, user_id)
);

ALTER TABLE public.ticket_agents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket agents"
  ON public.ticket_agents FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users create ticket agents"
  ON public.ticket_agents FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users delete ticket agents"
  ON public.ticket_agents FOR DELETE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ticket_agents_ticket ON public.ticket_agents (ticket_id);
CREATE INDEX idx_ticket_agents_user ON public.ticket_agents (user_id);
