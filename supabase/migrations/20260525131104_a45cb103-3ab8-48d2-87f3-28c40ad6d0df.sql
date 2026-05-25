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
  ORDER BY (
    SELECT COUNT(*) FROM public.zapi_chats zc
    WHERE zc.assigned_to = usa.user_id AND zc.status = 'em_atendimento'
  ) ASC,
  COALESCE(p.is_chat_available, true) DESC,
  COALESCE(p.last_seen_at, 'epoch'::timestamptz) DESC
  LIMIT 1;
$function$;