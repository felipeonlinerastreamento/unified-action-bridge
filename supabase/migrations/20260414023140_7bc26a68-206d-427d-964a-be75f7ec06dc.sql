
CREATE TABLE public.user_gsystem_links (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  gsystem_user_id text NOT NULL,
  gsystem_user_name text NOT NULL DEFAULT '',
  channel_id uuid REFERENCES public.channels(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (user_id, channel_id)
);

ALTER TABLE public.user_gsystem_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage gsystem links"
ON public.user_gsystem_links
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Auth users view gsystem links"
ON public.user_gsystem_links
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_user_gsystem_links_updated_at
BEFORE UPDATE ON public.user_gsystem_links
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
