ALTER TABLE public.crm_pipeline_stages ADD COLUMN IF NOT EXISTS sla_days integer NOT NULL DEFAULT 0;
ALTER TABLE public.crm_opportunities ADD COLUMN IF NOT EXISTS stage_entered_at timestamp with time zone NOT NULL DEFAULT now();

CREATE OR REPLACE FUNCTION public.crm_track_stage_entry()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id THEN
    NEW.stage_entered_at := now();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_track_stage_entry ON public.crm_opportunities;
CREATE TRIGGER trg_crm_track_stage_entry
BEFORE UPDATE OF stage_id ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_track_stage_entry();

CREATE OR REPLACE FUNCTION public.crm_require_loss_reason()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'lost' AND coalesce(btrim(NEW.loss_reason), '') = '' THEN
    RAISE EXCEPTION 'Informe o motivo da perda ao marcar a oportunidade como perdida';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_crm_require_loss_reason ON public.crm_opportunities;
CREATE TRIGGER trg_crm_require_loss_reason
BEFORE INSERT OR UPDATE ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.crm_require_loss_reason();
