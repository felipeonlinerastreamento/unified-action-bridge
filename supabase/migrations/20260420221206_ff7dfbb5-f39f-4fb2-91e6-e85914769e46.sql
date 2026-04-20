ALTER TABLE public.ticket_tracking
  ADD CONSTRAINT ticket_tracking_ticket_id_fkey
  FOREIGN KEY (ticket_id) REFERENCES public.service_tickets(id) ON DELETE CASCADE;