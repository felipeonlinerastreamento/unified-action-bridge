CREATE TABLE public.ai_manager_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  singleton BOOLEAN NOT NULL DEFAULT true UNIQUE,
  instructions TEXT NOT NULL DEFAULT '',
  updated_by UUID,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_manager_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "AI manager settings readable by admin and authorized gestor"
ON public.ai_manager_settings FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.can_access_ai_manager, true) = true
    )
  )
);

CREATE POLICY "AI manager settings updatable by admin and authorized gestor"
ON public.ai_manager_settings FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.can_access_ai_manager, true) = true
    )
  )
);

CREATE POLICY "AI manager settings insertable by admin and authorized gestor"
ON public.ai_manager_settings FOR INSERT
TO authenticated
WITH CHECK (
  public.has_role(auth.uid(), 'admin')
  OR (
    public.has_role(auth.uid(), 'gestor')
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = auth.uid()
        AND COALESCE(p.can_access_ai_manager, true) = true
    )
  )
);

CREATE TRIGGER trg_ai_manager_settings_updated_at
BEFORE UPDATE ON public.ai_manager_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.ai_manager_settings (singleton, instructions) VALUES (true, '');