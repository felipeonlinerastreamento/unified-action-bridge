CREATE TABLE public.bot_auto_reply_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT false,
  observe_only boolean NOT NULL DEFAULT true,
  greeting_seconds integer NOT NULL DEFAULT 10,
  follow_up_minutes integer NOT NULL DEFAULT 10,
  start_hour text NOT NULL DEFAULT '08:00',
  end_hour text NOT NULL DEFAULT '18:00',
  max_replies_per_chat integer NOT NULL DEFAULT 2,
  channel_id uuid NULL REFERENCES public.channels(id) ON DELETE SET NULL,
  skip_when_ticket_open boolean NOT NULL DEFAULT true,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_auto_reply_settings TO authenticated;
GRANT ALL ON public.bot_auto_reply_settings TO service_role;
ALTER TABLE public.bot_auto_reply_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_settings_select" ON public.bot_auto_reply_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_settings_write" ON public.bot_auto_reply_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_bot_auto_reply_settings_updated
  BEFORE UPDATE ON public.bot_auto_reply_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bot_auto_reply_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  keywords text[] NOT NULL DEFAULT '{}',
  reply_text text NOT NULL DEFAULT '',
  required_fields text[] NOT NULL DEFAULT '{}',
  target_sector text NULL,
  priority integer NOT NULL DEFAULT 100,
  from_catalog boolean NOT NULL DEFAULT false,
  catalog_key text NULL,
  is_greeting boolean NOT NULL DEFAULT false,
  create_ticket boolean NOT NULL DEFAULT false,
  ticket_priority text NOT NULL DEFAULT 'media',
  created_by uuid NULL,
  updated_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bot_auto_reply_rules TO authenticated;
GRANT ALL ON public.bot_auto_reply_rules TO service_role;
ALTER TABLE public.bot_auto_reply_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_rules_select" ON public.bot_auto_reply_rules
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "bot_rules_write" ON public.bot_auto_reply_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_bot_auto_reply_rules_updated
  BEFORE UPDATE ON public.bot_auto_reply_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.bot_auto_reply_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NULL,
  channel_id uuid NULL,
  message_id uuid NULL,
  rule_id uuid NULL REFERENCES public.bot_auto_reply_rules(id) ON DELETE SET NULL,
  rule_name text NULL,
  incoming_text text NULL,
  detected_intent text NULL,
  confidence numeric NULL,
  collected_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  reply_text text NULL,
  outcome text NOT NULL DEFAULT 'sent',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_bot_auto_reply_log_chat ON public.bot_auto_reply_log (chat_id, created_at DESC);
CREATE INDEX idx_bot_auto_reply_log_created ON public.bot_auto_reply_log (created_at DESC);

GRANT SELECT ON public.bot_auto_reply_log TO authenticated;
GRANT ALL ON public.bot_auto_reply_log TO service_role;
ALTER TABLE public.bot_auto_reply_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bot_log_select" ON public.bot_auto_reply_log
  FOR SELECT TO authenticated USING (true);

INSERT INTO public.bot_auto_reply_settings (is_enabled, observe_only) VALUES (false, true);