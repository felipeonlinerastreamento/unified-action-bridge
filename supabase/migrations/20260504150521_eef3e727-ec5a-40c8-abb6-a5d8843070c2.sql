
-- CSAT settings (single row)
CREATE TABLE public.csat_settings (
  id uuid primary key default gen_random_uuid(),
  is_enabled boolean not null default false,
  message text not null default E'Seu atendimento foi finalizado, obrigado!\n\nDigite uma nota para atendimento:\n[ 1 ] - Ruim 😒\n\n[ 2 ] - Bom 😊\n\n[ 3 ] - Ótimo 😍',
  thanks_message text not null default 'Obrigado pela sua avaliação!',
  updated_at timestamptz not null default now(),
  updated_by uuid
);
ALTER TABLE public.csat_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view csat settings" ON public.csat_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins gestors manage csat settings" ON public.csat_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));
CREATE TRIGGER update_csat_settings_updated_at BEFORE UPDATE ON public.csat_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Pending CSAT awaiting customer response
CREATE TABLE public.csat_pending (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null,
  chat_id uuid not null,
  phone text not null,
  contact_name text,
  ticket_id uuid,
  protocol text,
  operator_user_id uuid,
  operator_name text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '24 hours')
);
CREATE INDEX idx_csat_pending_lookup ON public.csat_pending(channel_id, phone);
ALTER TABLE public.csat_pending ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users manage csat pending" ON public.csat_pending
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);

-- CSAT responses (report)
CREATE TABLE public.csat_responses (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid,
  chat_id uuid,
  phone text,
  contact_name text,
  ticket_id uuid,
  protocol text,
  operator_user_id uuid,
  operator_name text,
  score smallint not null check (score between 1 and 3),
  score_label text not null,
  raw_response text,
  created_at timestamptz not null default now()
);
CREATE INDEX idx_csat_responses_created ON public.csat_responses(created_at desc);
CREATE INDEX idx_csat_responses_operator ON public.csat_responses(operator_user_id);
ALTER TABLE public.csat_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view csat responses" ON public.csat_responses
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users insert csat responses" ON public.csat_responses
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- Seed default settings row
INSERT INTO public.csat_settings (is_enabled) VALUES (false);
