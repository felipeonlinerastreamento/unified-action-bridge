ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_chat_available boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Allow each user to update their own presence and chat availability
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles' AND policyname = 'Users update own presence'
  ) THEN
    CREATE POLICY "Users update own presence"
      ON public.profiles
      FOR UPDATE
      TO authenticated
      USING (auth.uid() = user_id)
      WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

-- Update routing function: skip offline / unavailable agents (no heartbeat in last 2 minutes OR is_chat_available=false)
CREATE OR REPLACE FUNCTION public.pick_least_loaded_agent(_sector text)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT usa.user_id
  FROM public.user_sector_assignments usa
  JOIN public.sectors s ON s.id = usa.sector_id
  JOIN public.profiles p ON p.user_id = usa.user_id
  WHERE lower(s.name) = lower(_sector)
    AND s.is_active = true
    AND COALESCE(p.is_chat_available, true) = true
    AND p.last_seen_at IS NOT NULL
    AND p.last_seen_at > (now() - interval '2 minutes')
  ORDER BY (
    SELECT COUNT(*) FROM public.zapi_chats zc
    WHERE zc.assigned_to = usa.user_id AND zc.status = 'em_atendimento'
  ) ASC
  LIMIT 1;
$function$;