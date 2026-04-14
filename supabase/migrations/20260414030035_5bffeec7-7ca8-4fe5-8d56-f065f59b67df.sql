
-- Enum for flow instance status
CREATE TYPE public.flow_instance_status AS ENUM ('em_andamento', 'pausado', 'finalizado');

-- Table: service_flows
CREATE TABLE public.service_flows (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage flows" ON public.service_flows
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Auth users view flows" ON public.service_flows
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_service_flows_updated_at
  BEFORE UPDATE ON public.service_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: service_flow_steps
CREATE TABLE public.service_flow_steps (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  flow_id UUID NOT NULL REFERENCES public.service_flows(id) ON DELETE CASCADE,
  step_name TEXT NOT NULL,
  step_order INTEGER NOT NULL DEFAULT 1,
  sector_name TEXT NOT NULL DEFAULT '',
  is_required BOOLEAN NOT NULL DEFAULT true,
  allow_return BOOLEAN NOT NULL DEFAULT false,
  allow_skip BOOLEAN NOT NULL DEFAULT false,
  requires_assignment BOOLEAN NOT NULL DEFAULT false,
  expected_time_minutes INTEGER DEFAULT NULL,
  auto_advance BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_flow_steps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage flow steps" ON public.service_flow_steps
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Auth users view flow steps" ON public.service_flow_steps
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_service_flow_steps_updated_at
  BEFORE UPDATE ON public.service_flow_steps
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: service_flow_step_rules
CREATE TABLE public.service_flow_step_rules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  step_id UUID NOT NULL REFERENCES public.service_flow_steps(id) ON DELETE CASCADE,
  required_fields TEXT[] DEFAULT '{}',
  allowed_roles TEXT[] DEFAULT '{}',
  can_finalize BOOLEAN NOT NULL DEFAULT false,
  finalization_requires_decision BOOLEAN NOT NULL DEFAULT false,
  decision_options TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.service_flow_step_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage step rules" ON public.service_flow_step_rules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
  WITH CHECK (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'));

CREATE POLICY "Auth users view step rules" ON public.service_flow_step_rules
  FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_service_flow_step_rules_updated_at
  BEFORE UPDATE ON public.service_flow_step_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Table: attendance_flow_instances
CREATE TABLE public.attendance_flow_instances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_id TEXT NOT NULL,
  flow_id UUID NOT NULL REFERENCES public.service_flows(id) ON DELETE RESTRICT,
  current_step_id UUID REFERENCES public.service_flow_steps(id) ON DELETE SET NULL,
  status flow_instance_status NOT NULL DEFAULT 'em_andamento',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ DEFAULT NULL
);
ALTER TABLE public.attendance_flow_instances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage flow instances" ON public.attendance_flow_instances
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- Table: attendance_flow_history
CREATE TABLE public.attendance_flow_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  attendance_flow_instance_id UUID NOT NULL REFERENCES public.attendance_flow_instances(id) ON DELETE CASCADE,
  from_step_id UUID REFERENCES public.service_flow_steps(id) ON DELETE SET NULL,
  to_step_id UUID REFERENCES public.service_flow_steps(id) ON DELETE SET NULL,
  moved_by_user_id UUID DEFAULT NULL,
  movement_reason TEXT DEFAULT '',
  decision_value TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.attendance_flow_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users manage flow history" ON public.attendance_flow_history
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);
