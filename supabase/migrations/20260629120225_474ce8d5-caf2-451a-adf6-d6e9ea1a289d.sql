
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Permitir que o trigger de privilégio bloqueie alterações de is_active por não-admins
CREATE OR REPLACE FUNCTION public.prevent_profile_privilege_escalation()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.has_role(auth.uid(), 'admin') THEN
    RETURN NEW;
  END IF;

  IF NEW.can_access_ai_manager IS DISTINCT FROM OLD.can_access_ai_manager
     OR NEW.group_id IS DISTINCT FROM OLD.group_id
     OR NEW.attendance_target_minutes IS DISTINCT FROM OLD.attendance_target_minutes
     OR NEW.is_active IS DISTINCT FROM OLD.is_active
     OR NEW.user_id IS DISTINCT FROM OLD.user_id THEN
    RAISE EXCEPTION 'Not allowed to modify privileged profile fields';
  END IF;

  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.pick_least_loaded_agent(_sector text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT usa.user_id
  FROM public.user_sector_assignments usa
  JOIN public.sectors s ON s.id = usa.sector_id
  JOIN public.profiles p ON p.user_id = usa.user_id
  WHERE lower(s.name) = lower(_sector)
    AND s.is_active = true
    AND COALESCE(p.is_active, true) = true
    AND COALESCE(p.is_chat_available, true) = true
    AND p.last_seen_at IS NOT NULL
    AND p.last_seen_at > (now() - interval '2 minutes')
  ORDER BY (
    SELECT COUNT(*) FROM public.zapi_chats zc
    WHERE zc.assigned_to = usa.user_id AND zc.status = 'em_atendimento'
  ) ASC
  LIMIT 1;
$function$;

CREATE OR REPLACE FUNCTION public.pick_least_loaded_agent_any(_sector text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT usa.user_id
  FROM public.user_sector_assignments usa
  JOIN public.sectors s ON s.id = usa.sector_id
  JOIN public.profiles p ON p.user_id = usa.user_id
  WHERE lower(s.name) = lower(_sector)
    AND s.is_active = true
    AND COALESCE(p.is_active, true) = true
  ORDER BY (
    SELECT COUNT(*) FROM public.zapi_chats zc
    WHERE zc.assigned_to = usa.user_id AND zc.status = 'em_atendimento'
  ) ASC,
  COALESCE(p.is_chat_available, true) DESC,
  COALESCE(p.last_seen_at, 'epoch'::timestamptz) DESC
  LIMIT 1;
$function$;
