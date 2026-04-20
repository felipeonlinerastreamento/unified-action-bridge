CREATE TABLE public.tracking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auto_refresh_enabled boolean NOT NULL DEFAULT true,
  refresh_interval_minutes integer NOT NULL DEFAULT 60,
  notify_on_delivered boolean NOT NULL DEFAULT true,
  notify_on_exception boolean NOT NULL DEFAULT true,
  notify_sector_members boolean NOT NULL DEFAULT true,
  notify_assigned_only boolean NOT NULL DEFAULT false,
  auto_close_ticket_on_delivery boolean NOT NULL DEFAULT false,
  require_tracking_code boolean NOT NULL DEFAULT true,
  tracking_code_pattern text NOT NULL DEFAULT '^[A-Z]{2}\d{9}[A-Z]{2}$',
  whatsapp_notify_client boolean NOT NULL DEFAULT false,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view tracking settings"
  ON public.tracking_settings FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage tracking settings"
  ON public.tracking_settings FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_tracking_settings_updated_at
  BEFORE UPDATE ON public.tracking_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tracking_settings DEFAULT VALUES;