CREATE OR REPLACE FUNCTION public.crm_tab_allowed(_tab text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') THEN true
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.panel_only = true) THEN false
    WHEN NOT EXISTS (
      SELECT 1 FROM public.user_sector_assignments usa
      JOIN public.sectors s ON s.id = usa.sector_id
      JOIN public.sector_groups g ON g.id = s.group_id
      WHERE usa.user_id = auth.uid() AND g.allowed_menus IS NOT NULL
    ) THEN true
    ELSE EXISTS (
      SELECT 1 FROM public.user_sector_assignments usa
      JOIN public.sectors s ON s.id = usa.sector_id
      JOIN public.sector_groups g ON g.id = s.group_id
      WHERE usa.user_id = auth.uid() AND ('crm.' || _tab) = ANY (g.allowed_menus)
    )
  END
$$;

REVOKE ALL ON FUNCTION public.crm_tab_allowed(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.crm_tab_allowed(text) TO authenticated, service_role;

-- Backfill: grupos que já liberavam o CRM começam com todas as abas.
UPDATE public.sector_groups
SET allowed_menus = ARRAY(SELECT DISTINCT unnest(allowed_menus || ARRAY[
  'crm.tarefas','crm.pipeline','crm.fluxos','crm.aniversarios','crm.contatos','crm.categorias','crm.servicos-tecnicos'
]))
WHERE allowed_menus IS NOT NULL AND 'crm' = ANY (allowed_menus);

-- Tarefas do CRM
DROP POLICY IF EXISTS "Atendentes view assigned crm_tasks" ON public.crm_tasks;
CREATE POLICY "Atendentes view assigned crm_tasks" ON public.crm_tasks FOR SELECT
USING (auth.uid() IS NOT NULL AND (
  public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
  OR ((assigned_to = auth.uid() OR created_by = auth.uid()) AND public.crm_tab_allowed('tarefas'))
));

DROP POLICY IF EXISTS "Atendentes update own crm_tasks" ON public.crm_tasks;
CREATE POLICY "Atendentes update own crm_tasks" ON public.crm_tasks FOR UPDATE
USING ((assigned_to = auth.uid() OR created_by = auth.uid()) AND public.crm_tab_allowed('tarefas'));

DROP POLICY IF EXISTS "Auth users insert crm_tasks" ON public.crm_tasks;
CREATE POLICY "Auth users insert crm_tasks" ON public.crm_tasks FOR INSERT
WITH CHECK (auth.uid() IS NOT NULL AND public.crm_tab_allowed('tarefas'));

-- Fluxos do CRM
DROP POLICY IF EXISTS "Auth users view crm_postsale_rules" ON public.crm_postsale_rules;
CREATE POLICY "Auth users view crm_postsale_rules" ON public.crm_postsale_rules FOR SELECT
USING (auth.uid() IS NOT NULL AND public.crm_tab_allowed('fluxos'));

DROP POLICY IF EXISTS "Auth users view crm_postsale_steps" ON public.crm_postsale_steps;
CREATE POLICY "Auth users view crm_postsale_steps" ON public.crm_postsale_steps FOR SELECT
USING (auth.uid() IS NOT NULL AND public.crm_tab_allowed('fluxos'));

DROP POLICY IF EXISTS "Auth users view crm_postsale_queue" ON public.crm_postsale_queue;
CREATE POLICY "Auth users view crm_postsale_queue" ON public.crm_postsale_queue FOR SELECT
USING (auth.uid() IS NOT NULL AND public.crm_tab_allowed('fluxos'));