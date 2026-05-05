
ALTER TABLE public.crm_postsale_rules
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'sector',
  ADD COLUMN IF NOT EXISTS trigger_stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS trigger_category_id uuid REFERENCES public.crm_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_category_id uuid REFERENCES public.crm_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS final_stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL;

ALTER TABLE public.crm_postsale_steps
  ADD COLUMN IF NOT EXISTS move_to_category_id uuid REFERENCES public.crm_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS move_to_stage_id uuid REFERENCES public.crm_pipeline_stages(id) ON DELETE SET NULL;

ALTER TABLE public.crm_postsale_queue
  ADD COLUMN IF NOT EXISTS opportunity_id uuid REFERENCES public.crm_opportunities(id) ON DELETE CASCADE;

CREATE OR REPLACE FUNCTION public.enqueue_pipeline_flow_steps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rule record;
  v_step record;
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.stage_id IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.stage_id IS DISTINCT FROM OLD.stage_id) THEN
    FOR v_rule IN
      SELECT * FROM public.crm_postsale_rules
      WHERE is_active = true
        AND trigger_type = 'pipeline_stage'
        AND trigger_stage_id = NEW.stage_id
    LOOP
      FOR v_step IN
        SELECT * FROM public.crm_postsale_steps
        WHERE rule_id = v_rule.id
        ORDER BY position
      LOOP
        INSERT INTO public.crm_postsale_queue
          (rule_id, step_id, opportunity_id, contact_id, scheduled_for, status)
        VALUES
          (v_rule.id, v_step.id, NEW.id, NEW.contact_id,
           now() + make_interval(days => v_step.delay_days), 'pending');
      END LOOP;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enqueue_pipeline_flow ON public.crm_opportunities;
CREATE TRIGGER trg_enqueue_pipeline_flow
AFTER INSERT OR UPDATE OF stage_id ON public.crm_opportunities
FOR EACH ROW EXECUTE FUNCTION public.enqueue_pipeline_flow_steps();
