ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS panel_only boolean NOT NULL DEFAULT false;

-- Marca o usuário Painel como somente-painel
UPDATE public.profiles SET panel_only = true, is_chat_available = false WHERE user_id = '5a6a5478-00e5-41c6-87c7-178b24200767';

-- Remove vínculos de setor do usuário Painel (não participa de filas)
DELETE FROM public.user_sector_assignments WHERE user_id = '5a6a5478-00e5-41c6-87c7-178b24200767';

-- Desatribui chats em atendimento do usuário Painel (voltam para a fila)
UPDATE public.zapi_chats SET assigned_to = NULL, status = 'aguardando' WHERE assigned_to = '5a6a5478-00e5-41c6-87c7-178b24200767' AND status = 'em_atendimento';

-- Exclui usuários panel_only da distribuição automática
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
    AND COALESCE(p.panel_only, false) = false
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
    AND COALESCE(p.panel_only, false) = false
  ORDER BY (
    SELECT COUNT(*) FROM public.zapi_chats zc
    WHERE zc.assigned_to = usa.user_id AND zc.status = 'em_atendimento'
  ) ASC,
  COALESCE(p.is_chat_available, true) DESC,
  COALESCE(p.last_seen_at, 'epoch'::timestamptz) DESC
  LIMIT 1;
$function$;