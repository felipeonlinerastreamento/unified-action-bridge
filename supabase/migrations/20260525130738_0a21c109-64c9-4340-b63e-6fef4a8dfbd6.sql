CREATE OR REPLACE FUNCTION public.handle_reminder_completion()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_next_date timestamptz;
  v_root_id uuid;
  v_base timestamptz;
  v_hour int;
  v_minute int;
  v_target_dow int;
  v_current_dow int;
  v_diff int;
  v_day int;
BEGIN
  IF NEW.is_dismissed = true AND (OLD.is_dismissed IS NULL OR OLD.is_dismissed = false) THEN
    v_root_id := COALESCE(NEW.parent_reminder_id, NEW.id);
    v_base := COALESCE(NEW.completed_at, now());
    v_hour := EXTRACT(hour FROM NEW.reminder_date)::int;
    v_minute := EXTRACT(minute FROM NEW.reminder_date)::int;

    IF NEW.recurrence_type IS NOT NULL AND NEW.recurrence_type <> '' AND NEW.recurrence_type <> 'none' THEN
      CASE NEW.recurrence_type
        WHEN 'daily' THEN
          v_next_date := date_trunc('day', v_base) + interval '1 day'
                         + make_interval(hours => v_hour, mins => v_minute);
        WHEN 'weekly' THEN
          v_target_dow := EXTRACT(dow FROM NEW.reminder_date)::int;
          v_current_dow := EXTRACT(dow FROM v_base)::int;
          v_diff := ((v_target_dow - v_current_dow) + 7) % 7;
          IF v_diff = 0 THEN v_diff := 7; END IF;
          v_next_date := date_trunc('day', v_base) + make_interval(days => v_diff)
                         + make_interval(hours => v_hour, mins => v_minute);
        WHEN 'biweekly' THEN
          v_target_dow := EXTRACT(dow FROM NEW.reminder_date)::int;
          v_current_dow := EXTRACT(dow FROM v_base)::int;
          v_diff := ((v_target_dow - v_current_dow) + 7) % 7;
          IF v_diff = 0 THEN v_diff := 14; ELSE v_diff := v_diff + 7; END IF;
          v_next_date := date_trunc('day', v_base) + make_interval(days => v_diff)
                         + make_interval(hours => v_hour, mins => v_minute);
        WHEN 'monthly' THEN
          v_day := EXTRACT(day FROM NEW.reminder_date)::int;
          v_next_date := date_trunc('month', v_base) + interval '1 month'
                         + make_interval(days => LEAST(v_day, 28) - 1)
                         + make_interval(hours => v_hour, mins => v_minute);
        WHEN 'yearly' THEN
          v_next_date := v_base + interval '1 year';
        ELSE
          v_next_date := NULL;
      END CASE;

      IF v_next_date IS NOT NULL
         AND NEW.recurrence_end_date IS NOT NULL
         AND v_next_date > NEW.recurrence_end_date THEN
        v_next_date := NULL;
      END IF;
    END IF;

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

    IF v_next_date IS NOT NULL THEN
      INSERT INTO public.ticket_reminders (
        ticket_id, reminder_date, reminder_note, created_by,
        recurrence_type, recurrence_end_date, parent_reminder_id
      ) VALUES (
        NEW.ticket_id, v_next_date, NEW.reminder_note, NEW.created_by,
        NEW.recurrence_type, NEW.recurrence_end_date, v_root_id
      );

      UPDATE public.service_tickets
      SET reminder_date = v_next_date, reminder_note = NEW.reminder_note
      WHERE id = NEW.ticket_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;