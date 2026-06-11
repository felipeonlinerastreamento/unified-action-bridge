ALTER TABLE public.chat_controle_links
  ADD COLUMN IF NOT EXISTS ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE CASCADE;

ALTER TABLE public.chat_controle_links
  ALTER COLUMN chat_id DROP NOT NULL;

DO $$ BEGIN
  ALTER TABLE public.chat_controle_links
    ADD CONSTRAINT chat_controle_links_target_chk
    CHECK (chat_id IS NOT NULL OR ticket_id IS NOT NULL);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS chat_controle_links_ticket_id_key
  ON public.chat_controle_links(ticket_id)
  WHERE ticket_id IS NOT NULL;