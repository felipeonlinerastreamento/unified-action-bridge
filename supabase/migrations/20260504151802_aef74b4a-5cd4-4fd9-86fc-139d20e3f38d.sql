
CREATE TABLE public.message_trigger_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT true,
  keywords jsonb NOT NULL DEFAULT '[]'::jsonb,
  match_type text NOT NULL DEFAULT 'any',
  case_sensitive boolean NOT NULL DEFAULT false,
  action_type text NOT NULL DEFAULT 'floating_alert',
  alert_message text NOT NULL DEFAULT 'Atenção: palavra-chave detectada',
  alert_target_type text NOT NULL DEFAULT 'sector',
  alert_target_sector_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  alert_target_user_ids jsonb NOT NULL DEFAULT '[]'::jsonb,
  transfer_sector_id uuid,
  transfer_sector_name text,
  transfer_note text NOT NULL DEFAULT '',
  sound_enabled boolean NOT NULL DEFAULT false,
  cooldown_minutes integer NOT NULL DEFAULT 5,
  priority integer NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE public.message_trigger_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view trigger rules"
  ON public.message_trigger_rules FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage trigger rules"
  ON public.message_trigger_rules FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_message_trigger_rules_updated_at
  BEFORE UPDATE ON public.message_trigger_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.message_trigger_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid,
  rule_name text NOT NULL DEFAULT '',
  chat_id uuid,
  message_id uuid,
  channel_id uuid,
  phone text,
  contact_name text,
  matched_keyword text NOT NULL DEFAULT '',
  message_excerpt text NOT NULL DEFAULT '',
  action_taken jsonb NOT NULL DEFAULT '{}'::jsonb,
  recipient_user_id uuid,
  recipient_name text NOT NULL DEFAULT '',
  triggered_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz
);

CREATE INDEX idx_msg_trigger_logs_recipient ON public.message_trigger_logs(recipient_user_id, acknowledged_at);
CREATE INDEX idx_msg_trigger_logs_triggered ON public.message_trigger_logs(triggered_at DESC);

ALTER TABLE public.message_trigger_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view trigger logs"
  ON public.message_trigger_logs FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'admin')
    OR has_role(auth.uid(), 'gestor')
    OR auth.uid() = recipient_user_id
  );

CREATE POLICY "Auth users insert trigger logs"
  ON public.message_trigger_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Recipients update own trigger logs"
  ON public.message_trigger_logs FOR UPDATE TO authenticated
  USING (auth.uid() = recipient_user_id);

ALTER PUBLICATION supabase_realtime ADD TABLE public.message_trigger_logs;
ALTER TABLE public.message_trigger_logs REPLICA IDENTITY FULL;
