-- Chamado de serviço técnico finalizado fica na fila (setor) de quem finalizou.
-- Serviço técnico = protocolo com tech_stage ou categoria que exige termo técnico.

CREATE OR REPLACE FUNCTION public.setor_principal_do_usuario(_user uuid)
RETURNS text LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT s.name
    FROM public.user_sector_assignments a
    JOIN public.sectors s ON s.id = a.sector_id
   WHERE a.user_id = _user AND coalesce(s.is_active, true)
   ORDER BY a.created_at ASC
   LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.chamado_eh_servico_tecnico(_tech_stage text, _category text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT _tech_stage IS NOT NULL OR EXISTS (
    SELECT 1 FROM public.ticket_categories c
     WHERE (lower(c.label) = lower(coalesce(_category, '')) OR c.key = _category)
       AND coalesce(c.technical_term_type, 'none') <> 'none'
  )
$$;

CREATE OR REPLACE FUNCTION public.servico_tecnico_fila_do_finalizador()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _quem uuid; _setor text;
BEGIN
  IF NEW.status IS DISTINCT FROM 'finalizado' OR OLD.status = 'finalizado' THEN RETURN NEW; END IF;
  IF NOT public.chamado_eh_servico_tecnico(NEW.tech_stage, NEW.category) THEN RETURN NEW; END IF;
  _quem := coalesce(NEW.closed_by, auth.uid());
  IF _quem IS NULL THEN RETURN NEW; END IF;
  _setor := public.setor_principal_do_usuario(_quem);
  IF _setor IS NOT NULL THEN NEW.sector := _setor; END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS zz_servico_tecnico_fila_do_finalizador ON public.service_tickets;
CREATE TRIGGER zz_servico_tecnico_fila_do_finalizador
  BEFORE UPDATE OF status ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.servico_tecnico_fila_do_finalizador();

-- Corrige os já finalizados sem fila (ex.: #11165): setor de quem finalizou.
UPDATE public.service_tickets t
   SET sector = public.setor_principal_do_usuario(t.closed_by)
 WHERE t.status = 'finalizado'
   AND coalesce(t.sector, '') = ''
   AND t.closed_by IS NOT NULL
   AND public.chamado_eh_servico_tecnico(t.tech_stage, t.category)
   AND public.setor_principal_do_usuario(t.closed_by) IS NOT NULL;
