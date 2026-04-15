
-- Sector groups (categories of sectors)
CREATE TABLE public.sector_groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.sector_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage sector groups"
  ON public.sector_groups FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view sector groups"
  ON public.sector_groups FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_sector_groups_updated_at
  BEFORE UPDATE ON public.sector_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add group_id to sectors
ALTER TABLE public.sectors ADD COLUMN group_id uuid REFERENCES public.sector_groups(id) ON DELETE SET NULL;

-- User-sector assignments
CREATE TABLE public.user_sector_assignments (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  sector_id uuid NOT NULL REFERENCES public.sectors(id) ON DELETE CASCADE,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, sector_id)
);

ALTER TABLE public.user_sector_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage user sector assignments"
  ON public.user_sector_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view user sector assignments"
  ON public.user_sector_assignments FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);
