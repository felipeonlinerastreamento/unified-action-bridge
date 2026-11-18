CREATE TABLE public.ticket_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE,
  label text NOT NULL,
  source text NOT NULL DEFAULT 'local' CHECK (source IN ('gsystem', 'local')),
  gsystem_key text,
  is_active boolean NOT NULL DEFAULT true,
  technical_term_type text NOT NULL DEFAULT 'none'
    CHECK (technical_term_type IN ('none', 'instalacao', 'manutencao', 'retirada', 'escolher')),
  position integer NOT NULL DEFAULT 0,
  last_synced_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_categories TO authenticated;
GRANT ALL ON public.ticket_categories TO service_role;
ALTER TABLE public.ticket_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read ticket categories"
  ON public.ticket_categories FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage ticket categories"
  ON public.ticket_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_ticket_categories_updated
  BEFORE UPDATE ON public.ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Backfill: categorias já usadas nas regras de encaminhamento.
INSERT INTO public.ticket_categories (key, label, source, gsystem_key, is_active)
SELECT DISTINCT ON (category_key) category_key, category_label,
  CASE WHEN category_key ~ '^\d+$' THEN 'gsystem' ELSE 'local' END,
  CASE WHEN category_key ~ '^\d+$' THEN category_key ELSE NULL END,
  true
FROM public.category_routing_rules
WHERE coalesce(category_key, '') <> '' AND coalesce(category_label, '') <> ''
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.ticket_categories (key, label, source, technical_term_type, position)
VALUES ('servico-tecnico', 'Serviço Técnico', 'local', 'escolher', 0)
ON CONFLICT (key) DO NOTHING;

CREATE TABLE public.technical_term_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  instalacao_title text NOT NULL DEFAULT 'Comunicado de instalação',
  instalacao_text text NOT NULL DEFAULT 'Informamos que será realizada a instalação do equipamento de rastreamento no veículo indicado. O responsável deve disponibilizar o veículo no local e horário combinados. Ao aceitar, você autoriza a Online Rastreamento a agendar a visita técnica.',
  manutencao_title text NOT NULL DEFAULT 'Termo de manutenção técnica',
  manutencao_text text NOT NULL DEFAULT 'Antes de agendar a visita, nossa equipe realizou os procedimentos remotos listados abaixo. Caso a visita constate falha externa ao equipamento (ex.: bateria desconectada, violação ou dano), poderá haver cobrança da visita técnica conforme contrato. Ao aceitar, você autoriza o agendamento da manutenção.',
  retirada_title text NOT NULL DEFAULT 'Termo de retirada de equipamento',
  retirada_text text NOT NULL DEFAULT 'Será realizada a retirada do equipamento de rastreamento instalado no veículo indicado. O responsável deve disponibilizar o veículo no local e horário combinados. Ao aceitar, você autoriza o agendamento da retirada.',
  instalacao_checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  manutencao_checklist jsonb NOT NULL DEFAULT '["Solicitou reset chip", "Enviou reset SMS (com ignição ligada)", "Reconfigurar equipamento", "Conferir pacote de dados"]'::jsonb,
  retirada_checklist jsonb NOT NULL DEFAULT '["Conferir localização com agendamento", "Conferir ID equipamento"]'::jsonb,
  whatsapp_template text NOT NULL DEFAULT 'Olá {responsavel}! A {empresa} precisa do seu aceite para o serviço de {servico} no veículo {placa}. Acesse: {link}',
  email_subject text NOT NULL DEFAULT '{servico} — aceite necessário ({placa})',
  email_template text NOT NULL DEFAULT 'Olá {responsavel},

Para agendarmos o serviço de {servico} no veículo {placa} ({cliente}), precisamos do seu aceite no termo abaixo:

{link}',
  require_reject_reason boolean NOT NULL DEFAULT true,
  notify_creator boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE ON public.technical_term_settings TO authenticated;
GRANT ALL ON public.technical_term_settings TO service_role;
ALTER TABLE public.technical_term_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read technical term settings"
  ON public.technical_term_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage technical term settings"
  ON public.technical_term_settings FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_technical_term_settings_updated
  BEFORE UPDATE ON public.technical_term_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.technical_service_terms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  seq bigint GENERATED ALWAYS AS IDENTITY,
  token uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  service_type text NOT NULL CHECK (service_type IN ('instalacao', 'manutencao', 'retirada')),
  status text NOT NULL DEFAULT 'pendente' CHECK (status IN ('pendente', 'aceito', 'recusado', 'enviada', 'cancelado')),
  ticket_id uuid REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  client_name text,
  plate text,
  equipment_id text,
  address text,
  responsible_name text NOT NULL,
  responsible_phone text,
  responsible_email text,
  description text,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  term_title text NOT NULL,
  term_text text NOT NULL,
  sent_channels text[] NOT NULL DEFAULT '{}',
  send_errors jsonb NOT NULL DEFAULT '{}'::jsonb,
  sent_at timestamptz,
  viewer_cpf text,
  cpf_verified_at timestamptz,
  first_viewed_at timestamptz,
  last_viewed_at timestamptz,
  view_count integer NOT NULL DEFAULT 0,
  responded_at timestamptz,
  responder_name text,
  responder_cpf text,
  responder_note text,
  responder_ip text,
  responder_user_agent text,
  scheduled_at timestamptz,
  scheduled_by uuid,
  schedule_kind text,
  schedule_reference text,
  cancelled_at timestamptz,
  cancelled_by uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_technical_terms_status ON public.technical_service_terms (status, created_at DESC);
CREATE INDEX idx_technical_terms_ticket ON public.technical_service_terms (ticket_id);

-- Leitura para a equipe; toda gravação passa pelas ações do servidor.
GRANT SELECT ON public.technical_service_terms TO authenticated;
GRANT ALL ON public.technical_service_terms TO service_role;
ALTER TABLE public.technical_service_terms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read technical terms"
  ON public.technical_service_terms FOR SELECT TO authenticated USING (true);

CREATE TRIGGER trg_technical_service_terms_updated
  BEFORE UPDATE ON public.technical_service_terms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.enforce_technical_term_before_finalize()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _type text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'finalizado' THEN RETURN NEW; END IF;
  -- Processos automáticos do sistema e gestores (contingência) passam.
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') THEN RETURN NEW; END IF;
  IF coalesce(NEW.category, '') = '' THEN RETURN NEW; END IF;

  SELECT technical_term_type INTO _type
  FROM public.ticket_categories
  WHERE lower(label) = lower(NEW.category) OR key = NEW.category
  ORDER BY (lower(label) = lower(NEW.category)) DESC
  LIMIT 1;

  IF _type IS NULL OR _type = 'none' THEN RETURN NEW; END IF;

  IF EXISTS (
    SELECT 1 FROM public.technical_service_terms
    WHERE ticket_id = NEW.id AND status = 'enviada'
  ) THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Este chamado exige termo de serviço técnico aceito pelo responsável e enviado para agendamento antes de finalizar (CRM > Serviços Técnicos).'
    USING ERRCODE = 'P0001';
END;
$$;

CREATE TRIGGER trg_service_tickets_technical_term
  BEFORE INSERT OR UPDATE OF status ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_technical_term_before_finalize();