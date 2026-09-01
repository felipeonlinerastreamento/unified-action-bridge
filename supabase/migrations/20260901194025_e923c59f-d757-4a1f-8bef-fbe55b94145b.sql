CREATE TABLE public.user_presence_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  last_ping_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz
);

CREATE INDEX idx_ups_user_started ON public.user_presence_sessions (user_id, started_at DESC);
CREATE INDEX idx_ups_open ON public.user_presence_sessions (user_id) WHERE ended_at IS NULL;

GRANT SELECT, INSERT, UPDATE ON public.user_presence_sessions TO authenticated;
GRANT ALL ON public.user_presence_sessions TO service_role;

ALTER TABLE public.user_presence_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ups_select_own_or_staff" ON public.user_presence_sessions
FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE OR REPLACE FUNCTION public.presence_heartbeat()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;

  UPDATE public.user_presence_sessions
  SET ended_at = last_ping_at
  WHERE ended_at IS NULL
    AND last_ping_at < now() - interval '3 minutes';

  SELECT id INTO v_id
  FROM public.user_presence_sessions
  WHERE user_id = v_uid AND ended_at IS NULL
  ORDER BY started_at DESC
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.user_presence_sessions (user_id) VALUES (v_uid);
  ELSE
    UPDATE public.user_presence_sessions SET last_ping_at = now() WHERE id = v_id;
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.presence_end_session()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN; END IF;
  UPDATE public.user_presence_sessions
  SET ended_at = now()
  WHERE user_id = v_uid AND ended_at IS NULL;
END;
$$;

GRANT EXECUTE ON FUNCTION public.presence_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.presence_end_session() TO authenticated;