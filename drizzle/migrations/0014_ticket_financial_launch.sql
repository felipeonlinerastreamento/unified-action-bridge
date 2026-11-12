ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS financial_pending boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS financial_notes text,
  ADD COLUMN IF NOT EXISTS financial_requested_by uuid,
  ADD COLUMN IF NOT EXISTS financial_requested_at timestamptz,
  ADD COLUMN IF NOT EXISTS financial_done_by uuid,
  ADD COLUMN IF NOT EXISTS financial_done_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_service_tickets_financial_pending ON public.service_tickets(financial_pending) WHERE financial_pending;