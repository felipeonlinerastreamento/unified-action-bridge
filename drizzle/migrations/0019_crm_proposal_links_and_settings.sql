CREATE TABLE public.crm_proposal_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  company_name text NOT NULL DEFAULT 'Online Rastreamento',
  company_cnpj text NOT NULL DEFAULT '',
  company_phone text NOT NULL DEFAULT '',
  company_email text NOT NULL DEFAULT 'suporte@onlinerastreamento.com.br',
  company_website text NOT NULL DEFAULT 'www.onlinerastreamento.com.br',
  company_address text NOT NULL DEFAULT '',
  logo_url text NOT NULL DEFAULT '',
  primary_color text NOT NULL DEFAULT '#0f766e',
  public_base_url text NOT NULL DEFAULT 'https://unified-action-bridge.lovable.app',
  intro_text text NOT NULL DEFAULT 'Agradecemos a oportunidade de apresentar nossa proposta. Abaixo estão os itens e condições preparados para você.',
  terms_text text NOT NULL DEFAULT '',
  footer_text text NOT NULL DEFAULT '',
  validity_days integer NOT NULL DEFAULT 15 CHECK (validity_days BETWEEN 1 AND 365),
  require_reject_reason boolean NOT NULL DEFAULT true,
  sent_stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  accepted_stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  rejected_stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  whatsapp_channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  email_channel_id uuid REFERENCES public.email_channels(id) ON DELETE SET NULL,
  whatsapp_template text NOT NULL DEFAULT 'Olá {contato}! Segue a proposta comercial {numero} da {empresa}: {link}
Você pode aceitar ou recusar direto pelo link. Validade: {validade}.',
  email_subject text NOT NULL DEFAULT 'Proposta comercial {numero} — {empresa}',
  email_template text NOT NULL DEFAULT 'Olá {contato},

Preparamos a proposta comercial {numero} para {cliente}. Para visualizar os itens e responder, acesse o link abaixo:

{link}

A proposta é válida até {validade}.',
  notify_owner boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.crm_proposal_settings ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.crm_proposal_settings TO authenticated;
GRANT ALL ON public.crm_proposal_settings TO service_role;

CREATE POLICY "Authenticated read proposal settings"
  ON public.crm_proposal_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins and gestores manage proposal settings"
  ON public.crm_proposal_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_crm_proposal_settings_updated
  BEFORE UPDATE ON public.crm_proposal_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.crm_proposal_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES public.crm_opportunities(id) ON DELETE CASCADE,
  quote_id uuid REFERENCES public.crm_opportunity_quotes(id) ON DELETE SET NULL,
  snapshot jsonb NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'cancelled')),
  sent_channels text[] NOT NULL DEFAULT '{}',
  sent_to_phone text,
  sent_to_email text,
  send_errors jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  responded_at timestamptz,
  responder_name text,
  responder_note text,
  responder_ip text,
  responder_user_agent text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crm_proposal_links_opp ON public.crm_proposal_links (opportunity_id, created_at DESC);

ALTER TABLE public.crm_proposal_links ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.crm_proposal_links TO authenticated;
GRANT ALL ON public.crm_proposal_links TO service_role;

CREATE POLICY "Authenticated read proposal links"
  ON public.crm_proposal_links FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated create own proposal links"
  ON public.crm_proposal_links FOR INSERT TO authenticated
  WITH CHECK (created_by = auth.uid());
CREATE POLICY "Creator or managers update proposal links"
  ON public.crm_proposal_links FOR UPDATE TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));