REVOKE EXECUTE ON FUNCTION public.presence_heartbeat() FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.presence_end_session() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.presence_heartbeat() TO authenticated;
GRANT EXECUTE ON FUNCTION public.presence_end_session() TO authenticated;