
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
  SELECT protocol_number INTO _num FROM public.service_tickets WHERE id = NEW.ticket_id;
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
