CREATE OR REPLACE FUNCTION public.is_active_staff()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.is_active)
     AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.is_active_staff() TO authenticated;

DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname='public' AND c.relkind='r' AND c.relrowsecurity
      AND c.relname NOT IN ('profiles','user_roles')
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Only active staff" ON public.%I', t.relname);
    EXECUTE format('CREATE POLICY "Only active staff" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', t.relname);
  END LOOP;
END $$;

DROP POLICY IF EXISTS "Only active staff files" ON storage.objects;
CREATE POLICY "Only active staff files" ON storage.objects AS RESTRICTIVE FOR ALL TO authenticated
USING (bucket_id NOT IN ('ticket-attachments','chat-media','user-signatures','ai-knowledge','ai-attachments','database_export_26_10_26') OR public.is_active_staff())
WITH CHECK (bucket_id NOT IN ('ticket-attachments','chat-media','user-signatures','ai-knowledge','ai-attachments','database_export_26_10_26') OR public.is_active_staff());