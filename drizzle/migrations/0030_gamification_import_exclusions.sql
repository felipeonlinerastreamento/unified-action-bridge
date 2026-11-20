CREATE TABLE public.gamif_import_exclusions (
  legacy_id text PRIMARY KEY,
  name text,
  email text,
  reason text,
  excluded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamif_import_exclusions TO authenticated;
GRANT ALL ON public.gamif_import_exclusions TO service_role;
ALTER TABLE public.gamif_import_exclusions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gamif managers all" ON public.gamif_import_exclusions FOR ALL TO authenticated USING (public.gamif_is_manager()) WITH CHECK (public.gamif_is_manager());

CREATE OR REPLACE FUNCTION public.gamif_import_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores importam dados do TOP'; END IF;
  RETURN jsonb_build_object(
    'users', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'email', u.email, 'name', p.name, 'is_active', p.is_active))
                       FROM public.profiles p JOIN auth.users u ON u.id = p.user_id), '[]'::jsonb),
    'sectors', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)) FROM public.sectors s), '[]'::jsonb),
    'links', coalesce((SELECT jsonb_agg(jsonb_build_object('legacy_id', l.legacy_id, 'user_id', l.user_id, 'status', l.status)) FROM public.gamif_legacy_users l), '[]'::jsonb),
    'exclusions', coalesce((SELECT jsonb_agg(jsonb_build_object('legacy_id', x.legacy_id, 'name', x.name, 'email', x.email)) FROM public.gamif_import_exclusions x), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.gamif_import_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamif_import_directory() TO authenticated;