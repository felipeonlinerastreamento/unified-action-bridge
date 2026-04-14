
-- Tabela de regras de SLA por setor
CREATE TABLE public.attendance_sla_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_name text NOT NULL,
  rule_name text NOT NULL,
  time_reference text NOT NULL DEFAULT 'from_open' CHECK (time_reference IN ('from_open', 'from_last_client_message', 'from_last_agent_message')),
  green_limit_minutes integer NOT NULL DEFAULT 2,
  yellow_limit_minutes integer NOT NULL DEFAULT 4,
  orange_limit_minutes integer NOT NULL DEFAULT 10,
  red_limit_minutes integer NOT NULL DEFAULT 15,
  green_color text NOT NULL DEFAULT '#22c55e',
  yellow_color text NOT NULL DEFAULT '#eab308',
  orange_color text NOT NULL DEFAULT '#f97316',
  red_color text NOT NULL DEFAULT '#ef4444',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_sla_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage sla rules" ON public.attendance_sla_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view sla rules" ON public.attendance_sla_rules
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_attendance_sla_rules_updated_at
  BEFORE UPDATE ON public.attendance_sla_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configurações de alertas
CREATE TABLE public.attendance_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notify_supervisor_on_red boolean NOT NULL DEFAULT true,
  highlight_critical_conversations boolean NOT NULL DEFAULT true,
  enable_sound_alert boolean NOT NULL DEFAULT false,
  enable_priority_sort boolean NOT NULL DEFAULT true,
  enable_blink_effect boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage alert settings" ON public.attendance_alert_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view alert settings" ON public.attendance_alert_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_attendance_alert_settings_updated_at
  BEFORE UPDATE ON public.attendance_alert_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configurações de métricas
CREATE TABLE public.attendance_metric_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_first_response_time boolean NOT NULL DEFAULT true,
  show_avg_interaction_time boolean NOT NULL DEFAULT true,
  show_total_service_time boolean NOT NULL DEFAULT true,
  show_queue_time boolean NOT NULL DEFAULT true,
  show_attention_count boolean NOT NULL DEFAULT true,
  show_risk_count boolean NOT NULL DEFAULT true,
  show_critical_count boolean NOT NULL DEFAULT true,
  show_transfer_rate boolean NOT NULL DEFAULT false,
  show_avg_transfer_time boolean NOT NULL DEFAULT false,
  show_reopen_rate boolean NOT NULL DEFAULT false,
  show_agent_productivity boolean NOT NULL DEFAULT true,
  show_sector_congestion boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_metric_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage metric settings" ON public.attendance_metric_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view metric settings" ON public.attendance_metric_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_attendance_metric_settings_updated_at
  BEFORE UPDATE ON public.attendance_metric_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de configurações visuais
CREATE TABLE public.attendance_visual_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  show_clock boolean NOT NULL DEFAULT true,
  show_sla_banner boolean NOT NULL DEFAULT true,
  show_status_badge boolean NOT NULL DEFAULT true,
  highlight_style text NOT NULL DEFAULT 'color' CHECK (highlight_style IN ('color', 'border', 'background')),
  critical_effect text NOT NULL DEFAULT 'color' CHECK (critical_effect IN ('blink', 'color')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_visual_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage visual settings" ON public.attendance_visual_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view visual settings" ON public.attendance_visual_settings
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_attendance_visual_settings_updated_at
  BEFORE UPDATE ON public.attendance_visual_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Inserir configurações padrão
INSERT INTO public.attendance_alert_settings (id) VALUES (gen_random_uuid());
INSERT INTO public.attendance_metric_settings (id) VALUES (gen_random_uuid());
INSERT INTO public.attendance_visual_settings (id) VALUES (gen_random_uuid());

-- Inserir regra SLA padrão para "Atendimento"
INSERT INTO public.attendance_sla_rules (sector_name, rule_name, time_reference, green_limit_minutes, yellow_limit_minutes, orange_limit_minutes, red_limit_minutes)
VALUES ('Atendimento', 'SLA Padrão Atendimento', 'from_open', 2, 4, 10, 15);
