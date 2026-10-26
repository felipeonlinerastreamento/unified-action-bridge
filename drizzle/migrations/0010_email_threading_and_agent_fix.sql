ALTER TABLE public.email_processed ADD COLUMN IF NOT EXISTS conversation_id text;
CREATE INDEX IF NOT EXISTS email_processed_conversation_idx ON public.email_processed(conversation_id);
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS email_reply_pending boolean NOT NULL DEFAULT false;
ALTER TABLE public.service_tickets ADD COLUMN IF NOT EXISTS email_reply_at timestamptz;

CREATE OR REPLACE FUNCTION public.pick_least_loaded_ticket_agent(_sector text)
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT p.user_id
  FROM public.user_sector_assignments usa
  JOIN public.sectors s ON s.id = usa.sector_id
  JOIN public.profiles p ON p.user_id = usa.user_id
  WHERE lower(trim(s.name)) = lower(trim(_sector))
    AND coalesce(p.is_active, true) = true
    AND coalesce(p.panel_only, false) = false
  GROUP BY p.user_id
  ORDER BY
    (SELECT count(*) FROM public.service_tickets t
      WHERE t.assigned_to = p.user_id AND t.status IN ('aberto','em_andamento','reaberto')) ASC,
    (EXISTS (SELECT 1 FROM public.user_presence_sessions ups
      WHERE ups.user_id = p.user_id AND ups.ended_at IS NULL AND ups.last_ping_at > now() - interval '5 minutes')) DESC,
    (SELECT max(t.created_at) FROM public.service_tickets t WHERE t.assigned_to = p.user_id) ASC NULLS FIRST
  LIMIT 1
$function$;