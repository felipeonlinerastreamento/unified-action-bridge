-- Revoke EXECUTE on SECURITY DEFINER functions from public/anon.
-- Triggers continue to fire (they run as table owner). 
-- Functions used in RLS / called from app remain executable by authenticated.

REVOKE EXECUTE ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_task_participant(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_task_creator(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_task_assigned(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.handle_reminder_completion() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.pick_least_loaded_agent(text) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.enqueue_pipeline_flow_steps() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.auto_advance_recurring_task() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.prevent_profile_privilege_escalation() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.enforce_admin_only_complete() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.list_channels_safe() FROM PUBLIC, anon;

-- Ensure authenticated keeps access where the app/RLS needs it
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_participant(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_creator(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_task_assigned(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.pick_least_loaded_agent(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.list_channels_safe() TO authenticated;