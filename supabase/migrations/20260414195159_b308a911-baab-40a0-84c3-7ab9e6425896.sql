
-- Create priority enum
CREATE TYPE public.ticket_priority AS ENUM ('baixa', 'media', 'alta', 'urgente');

-- Add 'reaberto' to service_ticket_status enum
ALTER TYPE public.service_ticket_status ADD VALUE IF NOT EXISTS 'reaberto';

-- Add new columns to service_tickets
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS priority public.ticket_priority NOT NULL DEFAULT 'media',
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS assigned_to uuid,
  ADD COLUMN IF NOT EXISTS sector text,
  ADD COLUMN IF NOT EXISTS reopened_at timestamptz;

-- Create ticket_comments table
CREATE TABLE public.ticket_comments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  user_id uuid,
  content text NOT NULL DEFAULT '',
  comment_type text NOT NULL DEFAULT 'comentario',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket comments"
  ON public.ticket_comments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users create ticket comments"
  ON public.ticket_comments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Create ticket_assignments table
CREATE TABLE public.ticket_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id uuid NOT NULL REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  assigned_to uuid,
  assigned_by uuid,
  sector_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view ticket assignments"
  ON public.ticket_assignments FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users create ticket assignments"
  ON public.ticket_assignments FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Index for performance
CREATE INDEX idx_ticket_comments_ticket_id ON public.ticket_comments(ticket_id);
CREATE INDEX idx_ticket_assignments_ticket_id ON public.ticket_assignments(ticket_id);
CREATE INDEX idx_service_tickets_status ON public.service_tickets(status);
CREATE INDEX idx_service_tickets_priority ON public.service_tickets(priority);
CREATE INDEX idx_service_tickets_assigned_to ON public.service_tickets(assigned_to);
