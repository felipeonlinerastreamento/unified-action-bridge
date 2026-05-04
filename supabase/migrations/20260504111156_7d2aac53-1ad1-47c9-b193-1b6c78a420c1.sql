CREATE TABLE public.pending_reminder_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  interval_hours numeric NOT NULL DEFAULT 2,
  quiet_start text NOT NULL DEFAULT '08:00',
  quiet_end text NOT NULL DEFAULT '18:00',
  weekdays integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  target_type text NOT NULL DEFAULT 'all',
  target_sector_ids uuid[] NOT NULL DEFAULT '{}',
  target_user_ids uuid[] NOT NULL DEFAULT '{}',
  show_open_chats boolean NOT NULL DEFAULT true,
  show_my_tickets boolean NOT NULL DEFAULT true,
  show_sector_tickets boolean NOT NULL DEFAULT true,
  min_total_to_show integer NOT NULL DEFAULT 1,
  sound_enabled boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.pending_reminder_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view pending reminder settings"
ON public.pending_reminder_settings
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage pending reminder settings"
ON public.pending_reminder_settings
FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_pending_reminder_settings_updated_at
BEFORE UPDATE ON public.pending_reminder_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();