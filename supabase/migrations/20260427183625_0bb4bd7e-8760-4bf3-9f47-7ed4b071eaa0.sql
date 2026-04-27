-- Permitir que qualquer usuário autenticado edite/exclua respostas rápidas GLOBAIS,
-- mantendo as não-globais restritas ao criador (ou admin/gestor).
DROP POLICY IF EXISTS "Users manage own quick replies" ON public.zapi_quick_replies;

CREATE POLICY "Auth users insert quick replies"
ON public.zapi_quick_replies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Edit quick replies (own or global)"
ON public.zapi_quick_replies
FOR UPDATE
TO authenticated
USING (
  auth.uid() = created_by
  OR is_global = true
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
)
WITH CHECK (
  auth.uid() = created_by
  OR is_global = true
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

CREATE POLICY "Delete quick replies (own or admin/gestor)"
ON public.zapi_quick_replies
FOR DELETE
TO authenticated
USING (
  auth.uid() = created_by
  OR has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);