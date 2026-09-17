CREATE OR REPLACE FUNCTION public.sys_can_monitor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT
    COALESCE(
      (current_setting('request.jwt.claims', true)::jsonb ->> 'role') = 'service_role',
      false
    )
    OR public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor');
$$;