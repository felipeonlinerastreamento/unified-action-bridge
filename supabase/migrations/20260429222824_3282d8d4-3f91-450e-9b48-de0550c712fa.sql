
-- Add read_at and campaign_id to notifications
ALTER TABLE public.notifications 
  ADD COLUMN IF NOT EXISTS read_at timestamp with time zone,
  ADD COLUMN IF NOT EXISTS campaign_id uuid,
  ADD COLUMN IF NOT EXISTS show_as_popup boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS popup_dismissed_at timestamp with time zone;

-- Backfill read_at for already-read notifications
UPDATE public.notifications SET read_at = created_at WHERE is_read = true AND read_at IS NULL;

-- Campaigns table
CREATE TABLE IF NOT EXISTS public.notification_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  target_type text NOT NULL, -- 'user' | 'sector' | 'group' | 'all'
  target_id text, -- user_id, sector name, or group_id; null for 'all'
  target_label text NOT NULL DEFAULT '',
  show_as_popup boolean NOT NULL DEFAULT true,
  recipients_count integer NOT NULL DEFAULT 0,
  created_by uuid,
  created_by_name text NOT NULL DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.notification_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage campaigns" ON public.notification_campaigns
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view campaigns" ON public.notification_campaigns
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_notifications_campaign_id ON public.notifications(campaign_id);
CREATE INDEX IF NOT EXISTS idx_notifications_user_popup ON public.notifications(user_id, show_as_popup, popup_dismissed_at);
