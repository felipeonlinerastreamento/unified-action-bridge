ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS technical_term_override_reason text, ADD COLUMN IF NOT EXISTS technical_term_override_by uuid;

CREATE OR REPLACE FUNCTION public.enforce_technical_term_before_finalize()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _type text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'finalizado' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF coalesce(NEW.is_recurring, false) THEN RETURN NEW; END IF;
  IF coalesce(NEW.category, '') = '' THEN RETURN NEW; END IF;
  SELECT technical_term_type INTO _type FROM public.ticket_categories
  WHERE lower(label) = lower(NEW.category) OR key = NEW.category
  ORDER BY (lower(label) = lower(NEW.category)) DESC LIMIT 1;
  IF _type IS NULL OR _type = 'none' THEN RETURN NEW; END IF;
  IF EXISTS (SELECT 1 FROM public.technical_service_terms WHERE ticket_id = NEW.id AND status = 'enviada') THEN RETURN NEW; END IF;
  IF length(trim(coalesce(NEW.technical_term_override_reason, ''))) >= 10
     AND (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')) THEN
    NEW.technical_term_override_by := auth.uid();
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Este chamado exige termo de serviço técnico aceito pelo responsável e enviado para agendamento antes de finalizar (CRM > Serviços Técnicos). Gestores podem finalizar informando justificativa de contingência.'
    USING ERRCODE = 'P0001';
END; $$;