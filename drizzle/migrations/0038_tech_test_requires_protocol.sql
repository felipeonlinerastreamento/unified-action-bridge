
CREATE OR REPLACE FUNCTION public.enforce_tech_test_protocol() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalizado' OR OLD.status = 'finalizado' THEN RETURN NEW; END IF;
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF lower(coalesce(NEW.category,'')) NOT LIKE '%teste de equipamento%' THEN RETURN NEW; END IF;
  IF NEW.created_at < timestamptz '2026-11-20 19:00:00+00' THEN RETURN NEW; END IF;
  IF NEW.tech_protocol_id IS NOT NULL AND NEW.test_result IS NOT NULL THEN RETURN NEW; END IF;
  IF length(trim(coalesce(NEW.technical_term_override_reason,''))) >= 10
     AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'Teste de equipamento exige protocolo de serviço técnico válido e resultado (Teste parcial ou Serviço concluído) antes de finalizar.' USING ERRCODE='P0001';
END $$;
DROP TRIGGER IF EXISTS trg_enforce_tech_test_protocol ON public.service_tickets;
CREATE TRIGGER trg_enforce_tech_test_protocol BEFORE UPDATE OF status ON public.service_tickets
FOR EACH ROW EXECUTE FUNCTION public.enforce_tech_test_protocol();
