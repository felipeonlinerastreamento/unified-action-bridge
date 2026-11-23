-- Teste de equipamento: finalizar exige protocolo de serviço técnico OU justificativa de "sem protocolo".
-- A justificativa gera um registro no relatório de gatilhos (message_trigger_logs) e um comentário no chamado.

ALTER TABLE public.service_tickets
  ADD COLUMN IF NOT EXISTS teste_sem_protocolo_justificativa text,
  ADD COLUMN IF NOT EXISTS teste_sem_protocolo_por uuid,
  ADD COLUMN IF NOT EXISTS teste_sem_protocolo_em timestamptz;

CREATE OR REPLACE FUNCTION public.enforce_tech_test_protocol() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalizado' OR OLD.status = 'finalizado' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF lower(coalesce(NEW.category,'')) NOT LIKE '%teste de equipamento%' THEN RETURN NEW; END IF;
  IF NEW.created_at < timestamptz '2026-11-20 19:00:00+00' THEN RETURN NEW; END IF;
  IF NEW.tech_protocol_id IS NOT NULL AND NEW.test_result IS NOT NULL THEN RETURN NEW; END IF;
  IF length(trim(coalesce(NEW.teste_sem_protocolo_justificativa,''))) >= 10 THEN RETURN NEW; END IF;
  IF length(trim(coalesce(NEW.technical_term_override_reason,''))) >= 10
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Teste de equipamento exige o número do protocolo de serviço técnico (com o resultado do teste) ou a justificativa de "sem protocolo" antes de finalizar.' USING ERRCODE='P0001';
END $$;

CREATE OR REPLACE FUNCTION public.teste_sem_protocolo_gatilho() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _quem uuid; _nome text; _just text;
BEGIN
  _just := trim(coalesce(NEW.teste_sem_protocolo_justificativa, ''));
  IF _just = '' OR _just IS NOT DISTINCT FROM trim(coalesce(OLD.teste_sem_protocolo_justificativa, '')) THEN RETURN NEW; END IF;
  _quem := coalesce(auth.uid(), NEW.teste_sem_protocolo_por);
  SELECT name INTO _nome FROM public.profiles WHERE user_id = _quem LIMIT 1;

  INSERT INTO public.message_trigger_logs
    (rule_name, matched_keyword, message_excerpt, contact_name, phone, recipient_name, action_taken)
  VALUES (
    'Teste de equipamento sem protocolo',
    'Teste sem protocolo',
    left(format('#%s — %s%s', lpad(coalesce(NEW.protocol_number::text, ''), 5, '0'),
                _just, CASE WHEN _nome IS NOT NULL THEN ' (por ' || _nome || ')' ELSE '' END), 1000),
    NEW.contact_name,
    NEW.contact_phone,
    coalesce(_nome, ''),
    jsonb_build_object('tipo', 'teste_sem_protocolo', 'ticket_id', NEW.id, 'protocol_number', NEW.protocol_number,
                       'placa', NEW.plate, 'usuario', _quem)
  );

  INSERT INTO public.ticket_comments (ticket_id, user_id, comment_type, content)
  VALUES (NEW.id, _quem, 'comentario', 'Teste de equipamento sem protocolo de serviço técnico. Justificativa: ' || _just);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_teste_sem_protocolo_gatilho ON public.service_tickets;
CREATE TRIGGER trg_teste_sem_protocolo_gatilho
  AFTER UPDATE OF teste_sem_protocolo_justificativa ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.teste_sem_protocolo_gatilho();
