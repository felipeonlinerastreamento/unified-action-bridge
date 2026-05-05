-- 1. Novos campos em tasks
ALTER TABLE public.tasks
  ADD COLUMN IF NOT EXISTS recurrence_day_of_week smallint,
  ADD COLUMN IF NOT EXISTS recurrence_day_of_month smallint,
  ADD COLUMN IF NOT EXISTS admin_only_complete boolean NOT NULL DEFAULT false;

-- 2. Histórico de conclusões
CREATE TABLE IF NOT EXISTS public.task_completion_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.tasks(id) ON DELETE CASCADE,
  completed_by uuid NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  comment text NOT NULL,
  scheduled_for timestamptz,
  next_scheduled_for timestamptz,
  recurrence_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_task_completion_history_task ON public.task_completion_history(task_id);

ALTER TABLE public.task_completion_history ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "View task completion history" ON public.task_completion_history;
CREATE POLICY "View task completion history"
ON public.task_completion_history FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR public.has_role(auth.uid(), 'gestor')
  OR public.is_task_creator(auth.uid(), task_id)
  OR public.is_task_assigned(auth.uid(), task_id)
  OR public.is_task_participant(auth.uid(), task_id)
);

DROP POLICY IF EXISTS "Insert task completion history" ON public.task_completion_history;
CREATE POLICY "Insert task completion history"
ON public.task_completion_history FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = completed_by);

-- 3. Atualizar trigger de auto-avanço para considerar dia semana / dia mês
CREATE OR REPLACE FUNCTION public.auto_advance_recurring_task()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next_due timestamptz;
  v_base timestamptz;
  v_dow int;
  v_target_dow int;
  v_diff int;
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND NEW.recurrence_type IS NOT NULL
     AND NEW.recurrence_type <> 'none' THEN

    v_base := COALESCE(NEW.due_date, now());

    CASE NEW.recurrence_type
      WHEN 'daily' THEN
        v_next_due := v_base + interval '1 day';
      WHEN 'weekly' THEN
        v_next_due := v_base + interval '7 days';
        IF NEW.recurrence_day_of_week IS NOT NULL THEN
          v_dow := EXTRACT(DOW FROM v_next_due)::int;
          v_target_dow := NEW.recurrence_day_of_week;
          v_diff := ((v_target_dow - v_dow) + 7) % 7;
          v_next_due := v_next_due + make_interval(days => v_diff);
        END IF;
      WHEN 'biweekly' THEN
        v_next_due := v_base + interval '14 days';
        IF NEW.recurrence_day_of_week IS NOT NULL THEN
          v_dow := EXTRACT(DOW FROM v_next_due)::int;
          v_target_dow := NEW.recurrence_day_of_week;
          v_diff := ((v_target_dow - v_dow) + 7) % 7;
          v_next_due := v_next_due + make_interval(days => v_diff);
        END IF;
      WHEN 'monthly' THEN
        v_next_due := v_base + interval '1 month';
        IF NEW.recurrence_day_of_month IS NOT NULL THEN
          v_next_due := date_trunc('month', v_next_due)
                        + make_interval(days => LEAST(NEW.recurrence_day_of_month, 28) - 1)
                        + (v_next_due - date_trunc('day', v_next_due));
        END IF;
      WHEN 'yearly' THEN
        v_next_due := v_base + interval '1 year';
      ELSE
        v_next_due := NULL;
    END CASE;

    IF v_next_due IS NOT NULL
       AND (NEW.recurrence_end_date IS NULL OR v_next_due <= NEW.recurrence_end_date) THEN
      NEW.status := 'pending';
      NEW.completed_at := NULL;
      NEW.due_date := v_next_due;
      NEW.updated_at := now();
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- 4. Bloquear conclusão por não-admin quando admin_only_complete = true
CREATE OR REPLACE FUNCTION public.enforce_admin_only_complete()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status = 'completed'
     AND (OLD.status IS NULL OR OLD.status <> 'completed')
     AND COALESCE(NEW.admin_only_complete, false) = true
     AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Apenas administradores podem concluir esta tarefa';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_enforce_admin_only_complete ON public.tasks;
CREATE TRIGGER trg_enforce_admin_only_complete
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_admin_only_complete();

-- Garantir que trigger de auto-advance existe
DROP TRIGGER IF EXISTS trg_auto_advance_recurring_task ON public.tasks;
CREATE TRIGGER trg_auto_advance_recurring_task
BEFORE UPDATE OF status ON public.tasks
FOR EACH ROW EXECUTE FUNCTION public.auto_advance_recurring_task();