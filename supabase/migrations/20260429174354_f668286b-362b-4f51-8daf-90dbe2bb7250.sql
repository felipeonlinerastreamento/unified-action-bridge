
-- Tabela de canais de e-mail (Office 365 / Outlook)
CREATE TABLE public.email_channels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email_address TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  polling_enabled BOOLEAN NOT NULL DEFAULT true,
  default_sector TEXT,
  default_priority ticket_priority NOT NULL DEFAULT 'media',
  ignore_domains TEXT[] DEFAULT ARRAY[]::TEXT[],
  ignore_emails TEXT[] DEFAULT ARRAY[]::TEXT[],
  mark_as_read BOOLEAN NOT NULL DEFAULT true,
  last_polled_at TIMESTAMP WITH TIME ZONE,
  last_poll_status TEXT,
  last_poll_error TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.email_channels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/gestores podem gerenciar canais de email"
  ON public.email_channels FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Atendentes podem ver canais de email ativos"
  ON public.email_channels FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_email_channels_updated_at
  BEFORE UPDATE ON public.email_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de mensagens já processadas (anti-duplicação)
CREATE TABLE public.email_processed (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  email_channel_id UUID NOT NULL REFERENCES public.email_channels(id) ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  internet_message_id TEXT,
  ticket_id UUID REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  from_address TEXT,
  subject TEXT,
  received_at TIMESTAMP WITH TIME ZONE,
  processed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (email_channel_id, message_id)
);

ALTER TABLE public.email_processed ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins/gestores podem ver email_processed"
  ON public.email_processed FOR SELECT
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE INDEX idx_email_processed_channel ON public.email_processed(email_channel_id);
CREATE INDEX idx_email_processed_ticket ON public.email_processed(ticket_id) WHERE ticket_id IS NOT NULL;
