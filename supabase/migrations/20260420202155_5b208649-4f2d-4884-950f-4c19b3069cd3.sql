-- Add tracking_code to service_tickets
ALTER TABLE public.service_tickets
ADD COLUMN IF NOT EXISTS tracking_code text;

CREATE INDEX IF NOT EXISTS idx_service_tickets_tracking_code
ON public.service_tickets(tracking_code) WHERE tracking_code IS NOT NULL;

-- Tracking table
CREATE TABLE IF NOT EXISTS public.ticket_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE,
  tracking_code text NOT NULL,
  carrier text NOT NULL DEFAULT 'correios',
  last_status text,
  last_status_date timestamptz,
  last_location text,
  is_delivered boolean NOT NULL DEFAULT false,
  events jsonb NOT NULL DEFAULT '[]'::jsonb,
  last_checked_at timestamptz,
  last_error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ticket_tracking_code ON public.ticket_tracking(tracking_code);
CREATE INDEX IF NOT EXISTS idx_ticket_tracking_pending ON public.ticket_tracking(is_delivered) WHERE is_delivered = false;

ALTER TABLE public.ticket_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view tracking"
ON public.ticket_tracking FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert tracking"
ON public.ticket_tracking FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users update tracking"
ON public.ticket_tracking FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users delete tracking"
ON public.ticket_tracking FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_ticket_tracking_updated_at
BEFORE UPDATE ON public.ticket_tracking
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  ticket_id uuid,
  type text NOT NULL,
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
ON public.notifications(user_id, is_read, created_at DESC);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own notifications"
ON public.notifications FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications"
ON public.notifications FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users delete own notifications"
ON public.notifications FOR DELETE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Auth users insert notifications"
ON public.notifications FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Realtime
ALTER TABLE public.notifications REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;