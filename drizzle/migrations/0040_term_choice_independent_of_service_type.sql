ALTER TABLE public.technical_term_types
  ADD COLUMN IF NOT EXISTS default_service_type text
  CHECK (default_service_type IS NULL OR default_service_type IN ('instalacao','retirada','manutencao'));

UPDATE public.technical_term_types SET default_service_type = key
 WHERE key IN ('instalacao','retirada','manutencao') AND default_service_type IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS technical_term_types_default_service_uniq
  ON public.technical_term_types (default_service_type) WHERE default_service_type IS NOT NULL;

ALTER TABLE public.technical_service_terms
  ADD COLUMN IF NOT EXISTS term_type text,
  ADD COLUMN IF NOT EXISTS term_label text;

UPDATE public.technical_service_terms SET term_type = service_type WHERE term_type IS NULL;

CREATE INDEX IF NOT EXISTS technical_service_terms_term_type_idx ON public.technical_service_terms (term_type);

CREATE OR REPLACE FUNCTION public.validate_term_service_type()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Versões antigas do app gravam só service_type (= chave do termo).
  IF NEW.term_type IS NULL THEN
    NEW.term_type := NEW.service_type;
  END IF;
  IF TG_OP = 'UPDATE'
     AND NEW.service_type IS NOT DISTINCT FROM OLD.service_type
     AND NEW.term_type IS NOT DISTINCT FROM OLD.term_type THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.technical_term_types WHERE key = NEW.term_type) THEN
    RAISE EXCEPTION 'Termo de aceite inexistente: %', NEW.term_type;
  END IF;
  IF NEW.service_type NOT IN ('instalacao','retirada','manutencao') AND NEW.service_type IS DISTINCT FROM NEW.term_type THEN
    RAISE EXCEPTION 'Tipo de serviço inválido: %', NEW.service_type;
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_validate_term_service_type ON public.technical_service_terms;
CREATE TRIGGER trg_validate_term_service_type
  BEFORE INSERT OR UPDATE OF service_type, term_type ON public.technical_service_terms
  FOR EACH ROW EXECUTE FUNCTION public.validate_term_service_type();

CREATE OR REPLACE FUNCTION public.guard_technical_term_type_delete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF EXISTS (SELECT 1 FROM public.technical_service_terms WHERE term_type = OLD.key OR service_type = OLD.key) THEN
    RAISE EXCEPTION 'Este termo já foi usado e não pode ser excluído; ele pode apenas ser inativado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ticket_categories WHERE technical_term_type = OLD.key) THEN
    RAISE EXCEPTION 'Este termo é exigido por categorias em Encaminhamento.';
  END IF;
  RETURN OLD;
END;
$function$;

CREATE OR REPLACE FUNCTION public.delete_technical_term_type(_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_key text;
  v_cats text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administradores e gestores podem excluir termos.';
  END IF;
  SELECT key INTO v_key FROM public.technical_term_types WHERE id = _id;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Tipo de termo não encontrado.';
  END IF;
  SELECT string_agg(label, ', ' ORDER BY label) INTO v_cats
    FROM public.ticket_categories WHERE technical_term_type = v_key;
  IF v_cats IS NOT NULL THEN
    RAISE EXCEPTION 'Este termo é exigido pelas categorias: %. Altere-as em Encaminhamento antes de excluir.', v_cats;
  END IF;
  IF EXISTS (SELECT 1 FROM public.technical_service_terms WHERE term_type = v_key OR service_type = v_key) THEN
    UPDATE public.technical_term_types SET is_active = false, default_service_type = NULL, updated_by = auth.uid() WHERE id = _id;
    RETURN 'inativado';
  END IF;
  DELETE FROM public.technical_term_types WHERE id = _id;
  RETURN 'excluido';
END;
$function$;