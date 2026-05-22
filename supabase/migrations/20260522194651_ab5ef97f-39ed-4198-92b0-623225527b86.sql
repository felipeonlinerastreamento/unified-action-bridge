-- Restrict full row read of channels (which includes tokens) to admin/gestor only
DROP POLICY IF EXISTS "Roles view channels" ON public.channels;

CREATE POLICY "Admin/Gestor view channels"
ON public.channels
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'admin'::app_role)
  OR has_role(auth.uid(), 'gestor'::app_role)
);

-- Safe view exposing only non-sensitive columns for all authenticated roles
CREATE OR REPLACE VIEW public.channels_safe
WITH (security_invoker = true) AS
SELECT
  id,
  name,
  platform,
  is_active,
  created_at,
  updated_at
FROM public.channels;

-- Allow all authenticated roles to read the safe view
GRANT SELECT ON public.channels_safe TO authenticated;

-- The view inherits RLS via security_invoker; add a permissive policy
-- on the base table only for the safe columns by re-adding a SELECT
-- policy specifically for atendente reads through the view.
-- Since RLS is row-level, we expose the view via a SECURITY DEFINER
-- wrapper instead to bypass the table policy safely.
CREATE OR REPLACE FUNCTION public.list_channels_safe()
RETURNS TABLE (
  id uuid,
  name text,
  platform text,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id, name, platform, is_active, created_at, updated_at
  FROM public.channels
  WHERE
    has_role(auth.uid(), 'admin'::app_role)
    OR has_role(auth.uid(), 'gestor'::app_role)
    OR has_role(auth.uid(), 'atendente'::app_role);
$$;

REVOKE ALL ON FUNCTION public.list_channels_safe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_channels_safe() TO authenticated;

-- Drop the view (we prefer the function for clean role checks)
DROP VIEW IF EXISTS public.channels_safe;