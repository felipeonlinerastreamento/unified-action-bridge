
-- ============ ALTERS ============
ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS contact_role text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS referred_by_contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS rfm_segment text,
  ADD COLUMN IF NOT EXISTS last_interaction_at timestamptz;

ALTER TABLE public.crm_contacts
  DROP CONSTRAINT IF EXISTS crm_contacts_contact_role_check;
ALTER TABLE public.crm_contacts
  ADD CONSTRAINT crm_contacts_contact_role_check
  CHECK (contact_role IN ('cliente','fornecedor','funcionario','parceiro','lead'));

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS contract_start date,
  ADD COLUMN IF NOT EXISTS contract_end date,
  ADD COLUMN IF NOT EXISTS contract_value numeric(14,2),
  ADD COLUMN IF NOT EXISTS contract_recurrence text;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS birth_date date;

-- ============ CRM TASKS ============
CREATE TABLE IF NOT EXISTS public.crm_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  task_type text NOT NULL DEFAULT 'followup', -- followup|birthday|postsale|renewal|nps|churn|recurring|other
  title text NOT NULL,
  description text DEFAULT '',
  due_date timestamptz,
  status text NOT NULL DEFAULT 'pending', -- pending|done|skipped|cancelled
  priority text NOT NULL DEFAULT 'media', -- baixa|media|alta|urgente
  assigned_to uuid,
  created_by uuid,
  completed_at timestamptz,
  completion_note text DEFAULT '',
  source_type text,
  source_id uuid,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_assigned ON public.crm_tasks(assigned_to);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_due ON public.crm_tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_contact ON public.crm_tasks(contact_id);
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_tasks" ON public.crm_tasks
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Atendentes view assigned crm_tasks" ON public.crm_tasks FOR SELECT
  USING (auth.uid() IS NOT NULL AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor')
    OR assigned_to = auth.uid() OR created_by = auth.uid()
  ));
CREATE POLICY "Atendentes update own crm_tasks" ON public.crm_tasks FOR UPDATE
  USING (assigned_to = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Auth users insert crm_tasks" ON public.crm_tasks FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER update_crm_tasks_updated_at BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ MESSAGE TEMPLATES ============
CREATE TABLE IF NOT EXISTS public.crm_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  event_type text NOT NULL DEFAULT 'manual', -- birthday|postsale|renewal|nps_promoter|nps_detractor|recurring|recovery|manual
  channel text NOT NULL DEFAULT 'whatsapp', -- whatsapp|email|sms
  subject text,
  body text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_message_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_message_templates" ON public.crm_message_templates
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_message_templates" ON public.crm_message_templates FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_crm_message_templates_updated_at BEFORE UPDATE ON public.crm_message_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ PIPELINE STAGES ============
CREATE TABLE IF NOT EXISTS public.crm_pipeline_stages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  default_probability integer NOT NULL DEFAULT 0,
  is_won boolean NOT NULL DEFAULT false,
  is_lost boolean NOT NULL DEFAULT false,
  color text DEFAULT '#3b82f6',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_pipeline_stages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_pipeline_stages" ON public.crm_pipeline_stages
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_pipeline_stages" ON public.crm_pipeline_stages FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_crm_pipeline_stages_updated_at BEFORE UPDATE ON public.crm_pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ OPPORTUNITIES ============
CREATE TABLE IF NOT EXISTS public.crm_opportunities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  expected_value numeric(14,2) DEFAULT 0,
  probability integer NOT NULL DEFAULT 0,
  expected_close_date date,
  owner_id uuid,
  source text DEFAULT 'manual', -- manual|inbound|outbound|renewal|referral|website
  opportunity_type text NOT NULL DEFAULT 'new', -- new|upsell|renewal|recovery
  loss_reason text,
  notes text DEFAULT '',
  status text NOT NULL DEFAULT 'open', -- open|won|lost
  closed_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_stage ON public.crm_opportunities(stage_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_owner ON public.crm_opportunities(owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_opportunities_status ON public.crm_opportunities(status);
ALTER TABLE public.crm_opportunities ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_opportunities" ON public.crm_opportunities
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Owners view their crm_opportunities" ON public.crm_opportunities FOR SELECT
  USING (auth.uid() IS NOT NULL AND (
    has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor')
    OR owner_id = auth.uid() OR created_by = auth.uid()
  ));
CREATE POLICY "Owners update their crm_opportunities" ON public.crm_opportunities FOR UPDATE
  USING (owner_id = auth.uid() OR created_by = auth.uid());
CREATE POLICY "Auth users insert crm_opportunities" ON public.crm_opportunities FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE TRIGGER update_crm_opportunities_updated_at BEFORE UPDATE ON public.crm_opportunities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ POSTSALE ============
CREATE TABLE IF NOT EXISTS public.crm_postsale_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  trigger_sector text,
  trigger_category text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_postsale_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_postsale_rules" ON public.crm_postsale_rules
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_postsale_rules" ON public.crm_postsale_rules FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_crm_postsale_rules_updated_at BEFORE UPDATE ON public.crm_postsale_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.crm_postsale_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid NOT NULL REFERENCES public.crm_postsale_rules(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  delay_days integer NOT NULL DEFAULT 1,
  action_type text NOT NULL DEFAULT 'task', -- task|whatsapp|email|nps
  template_id uuid REFERENCES public.crm_message_templates(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.crm_postsale_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_postsale_steps" ON public.crm_postsale_steps
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_postsale_steps" ON public.crm_postsale_steps FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE TABLE IF NOT EXISTS public.crm_postsale_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id uuid REFERENCES public.crm_postsale_rules(id) ON DELETE CASCADE,
  step_id uuid REFERENCES public.crm_postsale_steps(id) ON DELETE CASCADE,
  ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE CASCADE,
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  contact_phone text,
  scheduled_for timestamptz NOT NULL,
  executed_at timestamptz,
  task_id uuid REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'pending', -- pending|done|skipped|failed
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_postsale_queue_sched ON public.crm_postsale_queue(scheduled_for, status);
ALTER TABLE public.crm_postsale_queue ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_postsale_queue" ON public.crm_postsale_queue
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_postsale_queue" ON public.crm_postsale_queue FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============ RECURRING CONTACTS ============
CREATE TABLE IF NOT EXISTS public.crm_recurring_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES public.crm_contacts(id) ON DELETE CASCADE,
  cadence text NOT NULL DEFAULT 'monthly', -- weekly|biweekly|monthly|quarterly|semiannual|yearly
  next_run_at timestamptz NOT NULL DEFAULT now(),
  channel text NOT NULL DEFAULT 'whatsapp',
  template_id uuid REFERENCES public.crm_message_templates(id) ON DELETE SET NULL,
  owner_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  notes text DEFAULT '',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_crm_recurring_next ON public.crm_recurring_contacts(next_run_at, is_active);
ALTER TABLE public.crm_recurring_contacts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_recurring_contacts" ON public.crm_recurring_contacts
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_recurring_contacts" ON public.crm_recurring_contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);
CREATE TRIGGER update_crm_recurring_contacts_updated_at BEFORE UPDATE ON public.crm_recurring_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ NPS RESPONSES ============
CREATE TABLE IF NOT EXISTS public.crm_nps_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid REFERENCES public.crm_contacts(id) ON DELETE SET NULL,
  ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  score integer NOT NULL CHECK (score BETWEEN 0 AND 10),
  category text GENERATED ALWAYS AS (
    CASE WHEN score >= 9 THEN 'promoter'
         WHEN score >= 7 THEN 'neutral'
         ELSE 'detractor' END
  ) STORED,
  comment text DEFAULT '',
  source text DEFAULT 'whatsapp',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_nps_score ON public.crm_nps_responses(score);
ALTER TABLE public.crm_nps_responses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins gestors manage crm_nps_responses" ON public.crm_nps_responses
  USING (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'))
  WITH CHECK (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'gestor'));
CREATE POLICY "Auth users view crm_nps_responses" ON public.crm_nps_responses FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- ============ SEED ============
INSERT INTO public.crm_pipeline_stages (name, position, default_probability, is_won, is_lost, color)
SELECT * FROM (VALUES
  ('Prospecção', 1, 10, false, false, '#94a3b8'),
  ('Qualificação', 2, 25, false, false, '#3b82f6'),
  ('Proposta', 3, 50, false, false, '#8b5cf6'),
  ('Negociação', 4, 75, false, false, '#f59e0b'),
  ('Fechado-Ganho', 5, 100, true, false, '#10b981'),
  ('Fechado-Perdido', 6, 0, false, true, '#ef4444')
) AS s(name, position, default_probability, is_won, is_lost, color)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_pipeline_stages);

INSERT INTO public.crm_message_templates (name, event_type, channel, body)
SELECT * FROM (VALUES
  ('Aniversário Cliente', 'birthday', 'whatsapp', 'Olá {nome}! 🎉 A equipe deseja um feliz aniversário! Conte sempre conosco.'),
  ('Pós-venda D+1', 'postsale', 'whatsapp', 'Oi {nome}, tudo certo com seu atendimento de ontem? Posso ajudar em algo?'),
  ('NPS Promotor', 'nps_promoter', 'whatsapp', 'Que bom que gostou, {nome}! 🌟 Pode nos ajudar deixando uma avaliação? https://g.page/r/seu-link'),
  ('NPS Detrator', 'nps_detractor', 'whatsapp', 'Sentimos muito, {nome}. Um responsável vai entrar em contato para resolver.'),
  ('Renovação D-30', 'renewal', 'whatsapp', 'Olá {nome}, seu contrato com a {empresa} vence em breve. Vamos renovar?')
) AS t(name, event_type, channel, body)
WHERE NOT EXISTS (SELECT 1 FROM public.crm_message_templates);
