CREATE TABLE public.ticket_error_entries (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  operator_user_id uuid,
  operator_name text NOT NULL DEFAULT '',
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  created_by uuid,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_error_entries TO authenticated;
GRANT ALL ON public.ticket_error_entries TO service_role;

ALTER TABLE public.ticket_error_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ticket_error_entries_select_auth" ON public.ticket_error_entries
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "ticket_error_entries_insert_auth" ON public.ticket_error_entries
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_error_entries_update_auth" ON public.ticket_error_entries
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "ticket_error_entries_delete_auth" ON public.ticket_error_entries
  FOR DELETE TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ticket_error_entries_ticket ON public.ticket_error_entries(ticket_id);
CREATE INDEX idx_ticket_error_entries_operator ON public.ticket_error_entries(operator_user_id);
CREATE INDEX idx_ticket_error_entries_created_at ON public.ticket_error_entries(created_at);

CREATE TRIGGER update_ticket_error_entries_updated_at
  BEFORE UPDATE ON public.ticket_error_entries
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();