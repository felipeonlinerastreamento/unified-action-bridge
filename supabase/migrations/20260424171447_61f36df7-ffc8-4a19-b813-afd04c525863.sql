-- Storage bucket for ticket attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('ticket-attachments', 'ticket-attachments', true)
ON CONFLICT (id) DO NOTHING;

-- Table to track attachments per ticket
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  uploaded_by UUID,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket attachments"
  ON public.ticket_attachments FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert ticket attachments"
  ON public.ticket_attachments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users delete own attachments"
  ON public.ticket_attachments FOR DELETE
  TO authenticated
  USING (auth.uid() = uploaded_by);

CREATE INDEX IF NOT EXISTS idx_ticket_attachments_ticket ON public.ticket_attachments(ticket_id);

-- Storage policies for the bucket
CREATE POLICY "Public read ticket attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Auth users upload ticket attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);

CREATE POLICY "Auth users delete own ticket attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);