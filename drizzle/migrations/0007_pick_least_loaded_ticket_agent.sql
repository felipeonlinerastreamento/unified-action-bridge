CREATE OR REPLACE FUNCTION public.pick_least_loaded_ticket_agent(_sector text)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.id
  FROM public.user_sector_assignments usa
  JOIN public.sectors s ON s.id = usa.sector_id
  JOIN public.profiles p ON p.id = usa.user_id
  WHERE lower(trim(s.name)) = lower(trim(_sector))
    AND coalesce(p.is_active, true) = true
    AND coalesce(p.panel_only, false) = false
  GROUP BY p.id
  ORDER BY
    (SELECT count(*) FROM public.service_tickets t
      WHERE t.assigned_to = p.id AND t.status IN ('aberto','em_andamento','reaberto')) ASC,
    (EXISTS (SELECT 1 FROM public.user_presence_sessions ups
      WHERE ups.user_id = p.id AND ups.ended_at IS NULL AND ups.last_ping_at > now() - interval '5 minutes')) DESC,
    (SELECT max(t.created_at) FROM public.service_tickets t WHERE t.assigned_to = p.id) ASC NULLS FIRST
  LIMIT 1
$$;
GRANT EXECUTE ON FUNCTION public.pick_least_loaded_ticket_agent(text) TO authenticated, service_role;