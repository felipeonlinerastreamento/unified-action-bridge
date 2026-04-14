
-- Add reminder fields to service_tickets
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS reminder_date timestamptz DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS reminder_note text DEFAULT NULL;

-- Create ticket_reminders table for reminder history
CREATE TABLE public.ticket_reminders (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  reminder_date timestamptz NOT NULL,
  reminder_note text DEFAULT '',
  created_by uuid DEFAULT NULL,
  is_dismissed boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_reminders ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket reminders"
  ON public.ticket_reminders FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users create ticket reminders"
  ON public.ticket_reminders FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users update ticket reminders"
  ON public.ticket_reminders FOR UPDATE
  USING (auth.uid() IS NOT NULL);

CREATE INDEX idx_ticket_reminders_date ON public.ticket_reminders (reminder_date) WHERE is_dismissed = false;
CREATE INDEX idx_ticket_reminders_ticket ON public.ticket_reminders (ticket_id);
