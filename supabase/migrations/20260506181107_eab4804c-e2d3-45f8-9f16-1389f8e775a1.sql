DROP POLICY IF EXISTS "Admins gestors view channels" ON public.channels;

CREATE POLICY "Roles view channels" ON public.channels
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

DROP POLICY IF EXISTS "Admins gestors view companies" ON public.companies;

CREATE POLICY "Roles view companies" ON public.companies
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );