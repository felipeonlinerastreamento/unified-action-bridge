CREATE TABLE IF NOT EXISTS public.escalation_gestao_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  target_sector_id uuid,
  target_sector_name text NOT NULL DEFAULT 'Gestão',
  default_notes text NOT NULL DEFAULT 'Atendimento escalado para análise da Gestão',
  default_category text NOT NULL DEFAULT 'Escalado para Gestão',
  notify_on_escalation boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.escalation_gestao_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage escalation gestao settings"
  ON public.escalation_gestao_settings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Auth users view escalation gestao settings"
  ON public.escalation_gestao_settings FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

-- Seed: tenta vincular ao setor Gestão existente
INSERT INTO public.escalation_gestao_settings (target_sector_id, target_sector_name)
SELECT id, name FROM public.sectors WHERE lower(name) = 'gestão' AND is_active = true LIMIT 1
ON CONFLICT DO NOTHING;

-- Coluna no service_tickets para marcar tickets escalados
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS escalated_to_gestao boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS escalated_from_ticket_id uuid;