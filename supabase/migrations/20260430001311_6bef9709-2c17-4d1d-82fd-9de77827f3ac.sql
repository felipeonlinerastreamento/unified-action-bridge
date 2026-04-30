
-- ===== CICLOS =====
CREATE TABLE public.okr_cycles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_cycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view okr cycles" ON public.okr_cycles
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage okr cycles" ON public.okr_cycles
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_okr_cycles_updated_at
  BEFORE UPDATE ON public.okr_cycles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== OBJECTIVES =====
CREATE TABLE public.okr_objectives (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id uuid NOT NULL REFERENCES public.okr_cycles(id) ON DELETE RESTRICT,
  level text NOT NULL CHECK (level IN ('empresa','setor','individual')),
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  owner_user_id uuid,
  parent_objective_id uuid REFERENCES public.okr_objectives(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'ativo' CHECK (status IN ('ativo','concluido','cancelado')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_objectives ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_okr_objectives_cycle ON public.okr_objectives(cycle_id);
CREATE INDEX idx_okr_objectives_owner ON public.okr_objectives(owner_user_id);
CREATE INDEX idx_okr_objectives_sector ON public.okr_objectives(sector_id);

CREATE POLICY "Auth users view objectives" ON public.okr_objectives
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage all objectives" ON public.okr_objectives
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestors manage objectives" ON public.okr_objectives
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Users insert own individual objectives" ON public.okr_objectives
  FOR INSERT TO authenticated
  WITH CHECK (level = 'individual' AND owner_user_id = auth.uid());

CREATE POLICY "Users update own individual objectives" ON public.okr_objectives
  FOR UPDATE TO authenticated
  USING (level = 'individual' AND owner_user_id = auth.uid());

CREATE TRIGGER trg_okr_objectives_updated_at
  BEFORE UPDATE ON public.okr_objectives
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ===== KEY RESULTS =====
CREATE TABLE public.okr_key_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  objective_id uuid NOT NULL REFERENCES public.okr_objectives(id) ON DELETE CASCADE,
  title text NOT NULL,
  kr_type text NOT NULL DEFAULT 'manual' CHECK (kr_type IN ('manual','automatico')),
  metric_key text,
  metric_filter jsonb NOT NULL DEFAULT '{}'::jsonb,
  unit text NOT NULL DEFAULT '',
  direction text NOT NULL DEFAULT 'increase' CHECK (direction IN ('increase','decrease')),
  initial_value numeric NOT NULL DEFAULT 0,
  target_value numeric NOT NULL,
  current_value numeric NOT NULL DEFAULT 0,
  responsible_user_id uuid,
  confidence text NOT NULL DEFAULT 'verde' CHECK (confidence IN ('verde','amarelo','vermelho')),
  last_auto_update_at timestamptz,
  display_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_key_results ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_okr_krs_objective ON public.okr_key_results(objective_id);
CREATE INDEX idx_okr_krs_responsible ON public.okr_key_results(responsible_user_id);

CREATE POLICY "Auth users view krs" ON public.okr_key_results
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage all krs" ON public.okr_key_results
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Gestors manage krs" ON public.okr_key_results
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Responsible updates own kr" ON public.okr_key_results
  FOR UPDATE TO authenticated
  USING (responsible_user_id = auth.uid());

-- ===== CHECK-INS =====
CREATE TABLE public.okr_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key_result_id uuid NOT NULL REFERENCES public.okr_key_results(id) ON DELETE CASCADE,
  previous_value numeric,
  new_value numeric NOT NULL,
  confidence text NOT NULL CHECK (confidence IN ('verde','amarelo','vermelho')),
  comment text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','automatico')),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_checkins ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_okr_checkins_kr ON public.okr_checkins(key_result_id);

CREATE POLICY "Auth users view checkins" ON public.okr_checkins
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users insert checkins" ON public.okr_checkins
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);

-- ===== ALERT SETTINGS (singleton) =====
CREATE TABLE public.okr_alert_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_red_confidence_days int NOT NULL DEFAULT 3,
  alert_no_checkin_days int NOT NULL DEFAULT 7,
  alert_cycle_ending_days int NOT NULL DEFAULT 3,
  alert_regression_threshold_pct numeric NOT NULL DEFAULT 20,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.okr_alert_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view okr alert settings" ON public.okr_alert_settings
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage okr alert settings" ON public.okr_alert_settings
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.okr_alert_settings DEFAULT VALUES;
