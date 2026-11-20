CREATE OR REPLACE FUNCTION public.guard_technical_term_type_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.technical_service_terms WHERE service_type = OLD.key) THEN
    RAISE EXCEPTION 'Este termo já foi usado e não pode ser excluído; ele pode apenas ser inativado.';
  END IF;
  IF EXISTS (SELECT 1 FROM public.ticket_categories WHERE technical_term_type = OLD.key) THEN
    RAISE EXCEPTION 'Este termo é exigido por categorias em Encaminhamento.';
  END IF;
  RETURN OLD;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_technical_term_type_delete() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER trg_guard_technical_term_type_delete
  BEFORE DELETE ON public.technical_term_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_technical_term_type_delete();