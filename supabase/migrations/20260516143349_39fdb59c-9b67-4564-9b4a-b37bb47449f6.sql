
CREATE TABLE public.ai_manager_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope text NOT NULL CHECK (scope IN ('customers','operators')),
  period_days integer NOT NULL CHECK (period_days IN (7,30,90)),
  payload jsonb NOT NULL,
  generated_by uuid,
  generated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_manager_reports_scope_time ON public.ai_manager_reports (scope, generated_at DESC);

ALTER TABLE public.ai_manager_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins and authorized gestors can view ai manager reports"
ON public.ai_manager_reports FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND COALESCE(p.can_access_ai_manager, true) = true
    )
  )
);

CREATE POLICY "Admins and authorized gestors can insert ai manager reports"
ON public.ai_manager_reports FOR INSERT TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid() AND COALESCE(p.can_access_ai_manager, true) = true
    )
  )
);

CREATE POLICY "Admins can delete ai manager reports"
ON public.ai_manager_reports FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
