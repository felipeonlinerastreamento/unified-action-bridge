ALTER TABLE public.message_trigger_rules
  ADD COLUMN IF NOT EXISTS create_ticket boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ticket_sector text,
  ADD COLUMN IF NOT EXISTS ticket_priority text NOT NULL DEFAULT 'alta',
  ADD COLUMN IF NOT EXISTS ticket_note text DEFAULT '';