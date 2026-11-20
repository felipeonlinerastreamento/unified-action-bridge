
ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS tech_stage text,
  ADD COLUMN IF NOT EXISTS tech_protocol_id uuid REFERENCES public.service_tickets(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS test_result text;
CREATE INDEX IF NOT EXISTS idx_service_tickets_tech_protocol ON public.service_tickets(tech_protocol_id) WHERE tech_protocol_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_tickets_tech_stage ON public.service_tickets(tech_stage) WHERE tech_stage IS NOT NULL;

ALTER TABLE public.technical_service_terms
  ADD COLUMN IF NOT EXISTS no_response_notified_at timestamptz,
  ADD COLUMN IF NOT EXISTS superseded_by uuid;

-- backfill de protocolos abertos com termo
UPDATE public.service_tickets t SET tech_stage = CASE
   WHEN x.status = 'enviada' THEN 'aguardando_agendamento' ELSE 'a_resolver' END
FROM (SELECT DISTINCT ON (ticket_id) ticket_id, status FROM public.technical_service_terms
      WHERE ticket_id IS NOT NULL AND status <> 'cancelado' ORDER BY ticket_id, created_at DESC) x
WHERE x.ticket_id = t.id AND t.status <> 'finalizado' AND t.tech_stage IS NULL;

-- termo -> etapa do protocolo + sino
CREATE OR REPLACE FUNCTION public.tech_term_cycle_sync() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _num text;
BEGIN
  IF NEW.ticket_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'INSERT' THEN
    UPDATE public.service_tickets SET tech_stage = 'a_resolver'
     WHERE id = NEW.ticket_id AND status <> 'finalizado'
       AND coalesce(tech_stage,'') NOT IN ('aguardando_agendamento');
    RETURN NEW;
  END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  SELECT coalesce(protocol, '#'||id::text) INTO _num FROM public.service_tickets WHERE id = NEW.ticket_id;
  IF NEW.status = 'enviada' THEN
    UPDATE public.service_tickets SET tech_stage = 'aguardando_agendamento' WHERE id = NEW.ticket_id AND status <> 'finalizado';
  ELSIF NEW.status IN ('aceito','recusado') AND NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, ticket_id, type, title, message, metadata, show_as_popup)
    VALUES (NEW.created_by, NEW.ticket_id, 'technical_term_'||NEW.status,
      CASE WHEN NEW.status='aceito' THEN 'Termo aceito' ELSE 'Termo recusado' END,
      format('Termo #%s (%s) do protocolo %s foi %s por %s.%s', NEW.seq, coalesce(NEW.service_label, NEW.service_type), coalesce(_num,'-'),
        NEW.status, coalesce(NEW.responder_name,'responsável'),
        CASE WHEN NEW.status='recusado' AND coalesce(NEW.responder_note,'')<>'' THEN ' Motivo: '||NEW.responder_note ELSE '' END),
      jsonb_build_object('term_id', NEW.id, 'status', NEW.status), true);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_tech_term_cycle_sync ON public.technical_service_terms;
CREATE TRIGGER trg_tech_term_cycle_sync AFTER INSERT OR UPDATE OF status ON public.technical_service_terms
FOR EACH ROW EXECUTE FUNCTION public.tech_term_cycle_sync();

-- validação do teste de equipamento vinculado
CREATE OR REPLACE FUNCTION public.validate_tech_test_protocol() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p record;
BEGIN
  IF NEW.tech_protocol_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND NEW.tech_protocol_id IS NOT DISTINCT FROM OLD.tech_protocol_id THEN RETURN NEW; END IF;
  IF NEW.tech_protocol_id = NEW.id THEN RAISE EXCEPTION 'O teste não pode apontar para ele mesmo.'; END IF;
  SELECT id, status, tech_stage INTO p FROM public.service_tickets WHERE id = NEW.tech_protocol_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'Protocolo de serviço técnico não encontrado.'; END IF;
  IF p.tech_stage IS NULL THEN RAISE EXCEPTION 'O protocolo informado não é de serviço técnico.'; END IF;
  IF p.status = 'finalizado' THEN RAISE EXCEPTION 'O protocolo de serviço técnico informado já está finalizado.'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_tech_test_protocol ON public.service_tickets;
CREATE TRIGGER trg_validate_tech_test_protocol BEFORE INSERT OR UPDATE OF tech_protocol_id ON public.service_tickets
FOR EACH ROW EXECUTE FUNCTION public.validate_tech_test_protocol();

-- nova regra de finalização do protocolo técnico
CREATE OR REPLACE FUNCTION public.enforce_technical_term_before_finalize() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalizado' THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' AND OLD.status = 'finalizado' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.tech_stage IS NULL OR (TG_OP = 'UPDATE' AND OLD.tech_stage IS NULL) THEN RETURN NEW; END IF;
  IF NEW.tech_stage = 'concluido' AND EXISTS (
     SELECT 1 FROM public.service_tickets WHERE tech_protocol_id = NEW.id AND test_result = 'concluido') THEN RETURN NEW; END IF;
  IF NEW.tech_stage = 'encerrado_recusa' AND length(trim(coalesce(NEW.technical_term_override_reason,''))) >= 5
     AND EXISTS (SELECT 1 FROM public.technical_service_terms WHERE ticket_id = NEW.id AND status = 'recusado') THEN RETURN NEW; END IF;
  IF length(trim(coalesce(NEW.technical_term_override_reason,''))) >= 10
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')) THEN
    NEW.technical_term_override_by := auth.uid();
    NEW.tech_stage := coalesce(nullif(NEW.tech_stage,'a_resolver'),'concluido');
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Protocolo de serviço técnico só finaliza pelo fluxo (teste "Serviço concluído" ou encerramento por recusa). Gestores podem finalizar com justificativa.' USING ERRCODE='P0001';
END $$;

-- aviso de 8h sem resposta
CREATE OR REPLACE FUNCTION public.tech_term_no_response_scan() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  WITH due AS (
    UPDATE public.technical_service_terms SET no_response_notified_at = now()
    WHERE status = 'pendente' AND sent_at IS NOT NULL AND sent_at < now() - interval '8 hours'
      AND no_response_notified_at IS NULL AND created_by IS NOT NULL
    RETURNING id, seq, ticket_id, created_by, client_name, coalesce(service_label, service_type) AS lbl)
  INSERT INTO public.notifications(user_id, ticket_id, type, title, message, metadata, show_as_popup)
  SELECT created_by, ticket_id, 'technical_term_no_response', 'Termo sem resposta há 8h',
    format('O termo #%s (%s) de %s ainda não foi respondido. Reenvie pelo chamado.', seq, lbl, coalesce(client_name,'cliente')),
    jsonb_build_object('term_id', id), true FROM due;
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.tech_term_no_response_scan() FROM PUBLIC, anon, authenticated;
