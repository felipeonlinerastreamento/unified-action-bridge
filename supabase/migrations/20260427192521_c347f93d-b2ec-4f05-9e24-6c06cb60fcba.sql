-- Settings table (singleton-ish)
CREATE TABLE public.attendance_event_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sla_band_change_enabled boolean NOT NULL DEFAULT true,
  sla_band_change_sound boolean NOT NULL DEFAULT false,
  daily_review_enabled boolean NOT NULL DEFAULT true,
  daily_review_time text NOT NULL DEFAULT '17:40',
  daily_review_message text NOT NULL DEFAULT 'Revise todos atendimentos',
  daily_review_sound boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_event_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view event settings"
  ON public.attendance_event_settings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage event settings"
  ON public.attendance_event_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_attendance_event_settings_updated_at
  BEFORE UPDATE ON public.attendance_event_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.attendance_event_settings DEFAULT VALUES;

-- Event history log
CREATE TABLE public.attendance_event_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- 'sla_band_change' | 'daily_review'
  message text NOT NULL DEFAULT '',
  chat_id text,
  user_id uuid,
  from_band text,
  to_band text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_event_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view event logs"
  ON public.attendance_event_logs FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert event logs"
  ON public.attendance_event_logs FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE INDEX idx_attendance_event_logs_created_at ON public.attendance_event_logs(created_at DESC);
CREATE INDEX idx_attendance_event_logs_type ON public.attendance_event_logs(event_type);