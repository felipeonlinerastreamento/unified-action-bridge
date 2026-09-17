CREATE INDEX IF NOT EXISTS idx_service_tickets_created_at ON public.service_tickets (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_service_tickets_status_created_at ON public.service_tickets (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_ticket_created ON public.ticket_comments (ticket_id, created_at DESC);