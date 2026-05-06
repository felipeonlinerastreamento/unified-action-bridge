DROP POLICY IF EXISTS "Admins gestors manage csat pending" ON public.csat_pending;

CREATE POLICY "Admins gestors manage csat pending"
ON public.csat_pending
FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Authenticated insert csat pending"
ON public.csat_pending
FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
  OR public.has_role(auth.uid(), 'atendente'::app_role)
);

CREATE POLICY "Authenticated delete own csat pending"
ON public.csat_pending
FOR DELETE TO authenticated
USING (
  operator_user_id = auth.uid()
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'gestor'::app_role)
);
