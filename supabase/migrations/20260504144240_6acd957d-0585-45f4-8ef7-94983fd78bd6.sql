-- Settings table
CREATE TABLE public.chat_inactivity_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  inactivity_minutes integer NOT NULL DEFAULT 15,
  alert_message text NOT NULL DEFAULT 'Necessário interação',
  target_type text NOT NULL DEFAULT 'assigned' CHECK (target_type IN ('assigned','all','sector','users')),
  target_sector_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_acknowledge boolean NOT NULL DEFAULT true,
  sound_enabled boolean NOT NULL DEFAULT false,
  cooldown_minutes integer NOT NULL DEFAULT 30,
  only_business_hours boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.chat_inactivity_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage chat inactivity settings"
  ON public.chat_inactivity_alert_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth users view chat inactivity settings"
  ON public.chat_inactivity_alert_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Logs table
CREATE TABLE public.chat_inactivity_alert_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid,
  chat_phone text,
  contact_name text,
  assigned_user_id uuid,
  recipient_user_id uuid NOT NULL,
  recipient_name text NOT NULL DEFAULT '',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  inactivity_minutes integer NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_from_me boolean,
  alert_message text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

ALTER TABLE public.chat_inactivity_alert_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users insert inactivity logs"
  ON public.chat_inactivity_alert_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Recipients update own inactivity logs"
  ON public.chat_inactivity_alert_logs
  FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_user_id);

CREATE POLICY "Admins gestors view inactivity logs"
  ON public.chat_inactivity_alert_logs
  FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR auth.uid() = recipient_user_id
  );

CREATE INDEX idx_inactivity_logs_chat ON public.chat_inactivity_alert_logs(chat_id, triggered_at DESC);
CREATE INDEX idx_inactivity_logs_recipient ON public.chat_inactivity_alert_logs(recipient_user_id, triggered_at DESC);
CREATE INDEX idx_inactivity_logs_triggered ON public.chat_inactivity_alert_logs(triggered_at DESC);

-- Seed single settings row
INSERT INTO public.chat_inactivity_alert_settings DEFAULT VALUES;