
-- 1. Add recurrence columns to ticket_reminders
ALTER TABLE public.ticket_reminders
  ADD COLUMN IF NOT EXISTS recurrence_type text,
  ADD COLUMN IF NOT EXISTS recurrence_end_date timestamptz,
  ADD COLUMN IF NOT EXISTS parent_reminder_id uuid REFERENCES public.ticket_reminders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS completion_comment text,
  ADD COLUMN IF NOT EXISTS completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS completed_by uuid;

-- 2. History table
CREATE TABLE IF NOT EXISTS public.ticket_reminder_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL,
  reminder_id uuid,
  parent_reminder_id uuid,
  scheduled_for timestamptz NOT NULL,
  completed_at timestamptz NOT NULL DEFAULT now(),
  completed_by uuid,
  reminder_note text DEFAULT '',
  completion_comment text DEFAULT '',
  recurrence_type text,
  next_scheduled_for timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reminder_history_ticket ON public.ticket_reminder_history(ticket_id);
CREATE INDEX IF NOT EXISTS idx_reminder_history_parent ON public.ticket_reminder_history(parent_reminder_id);

ALTER TABLE public.ticket_reminder_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view reminder history"
  ON public.ticket_reminder_history FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert reminder history"
  ON public.ticket_reminder_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- 3. Trigger: when a recurring reminder is dismissed, archive + reschedule
CREATE OR REPLACE FUNCTION public.handle_reminder_completion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_next_date timestamptz;
  v_root_id uuid;
BEGIN
  -- Only fire when transitioning to dismissed=true
  IF NEW.is_dismissed = true AND (OLD.is_dismissed IS NULL OR OLD.is_dismissed = false) THEN

    v_root_id := COALESCE(NEW.parent_reminder_id, NEW.id);

    -- Compute next date if recurrence is set
    IF NEW.recurrence_type IS NOT NULL AND NEW.recurrence_type <> '' AND NEW.recurrence_type <> 'none' THEN
      CASE NEW.recurrence_type
        WHEN 'daily'    THEN v_next_date := NEW.reminder_date + interval '1 day';
        WHEN 'weekly'   THEN v_next_date := NEW.reminder_date + interval '7 days';
        WHEN 'biweekly' THEN v_next_date := NEW.reminder_date + interval '14 days';
        WHEN 'monthly'  THEN v_next_date := NEW.reminder_date + interval '1 month';
        WHEN 'yearly'   THEN v_next_date := NEW.reminder_date + interval '1 year';
        ELSE v_next_date := NULL;
      END CASE;

      -- Respect end date
      IF v_next_date IS NOT NULL
         AND NEW.recurrence_end_date IS NOT NULL
         AND v_next_date > NEW.recurrence_end_date THEN
        v_next_date := NULL;
      END IF;
    END IF;

    -- Archive into history
    INSERT INTO public.ticket_reminder_history (
      ticket_id, reminder_id, parent_reminder_id,
      scheduled_for, completed_at, completed_by,
      reminder_note, completion_comment,
      recurrence_type, next_scheduled_for
    ) VALUES (
      NEW.ticket_id, NEW.id, v_root_id,
      NEW.reminder_date, COALESCE(NEW.completed_at, now()), NEW.completed_by,
      COALESCE(NEW.reminder_note, ''), COALESCE(NEW.completion_comment, ''),
      NEW.recurrence_type, v_next_date
    );

    -- If recurring & still within window, create the next reminder
    IF v_next_date IS NOT NULL THEN
      INSERT INTO public.ticket_reminders (
        ticket_id, reminder_date, reminder_note, created_by,
        recurrence_type, recurrence_end_date, parent_reminder_id
      ) VALUES (
        NEW.ticket_id, v_next_date, NEW.reminder_note, NEW.created_by,
        NEW.recurrence_type, NEW.recurrence_end_date, v_root_id
      );

      -- Mirror onto service_tickets reminder_date for legacy badge
      UPDATE public.service_tickets
      SET reminder_date = v_next_date, reminder_note = NEW.reminder_note
      WHERE id = NEW.ticket_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reminder_completion ON public.ticket_reminders;
CREATE TRIGGER trg_reminder_completion
  BEFORE UPDATE ON public.ticket_reminders
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_reminder_completion();
