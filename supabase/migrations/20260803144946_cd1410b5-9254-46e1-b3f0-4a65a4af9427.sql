-- Create table for offline routing settings
CREATE TABLE IF NOT EXISTS public.offline_routing_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    is_enabled BOOLEAN NOT NULL DEFAULT true,
    target_sector_id UUID REFERENCES public.sectors(id) ON DELETE SET NULL,
    target_sector_name TEXT,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_by UUID REFERENCES auth.users(id) ON DELETE SET NULL
);

-- Grant permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON public.offline_routing_settings TO authenticated;
GRANT ALL ON public.offline_routing_settings TO service_role;

-- Enable RLS
ALTER TABLE public.offline_routing_settings ENABLE ROW LEVEL SECURITY;

-- Policies
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'offline_routing_settings' AND policyname = 'Admins can manage offline_routing_settings'
    ) THEN
        CREATE POLICY "Admins can manage offline_routing_settings" 
        ON public.offline_routing_settings
        FOR ALL
        TO authenticated
        USING (public.has_role(auth.uid(), 'admin'));
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies WHERE tablename = 'offline_routing_settings' AND policyname = 'Everyone can read offline_routing_settings'
    ) THEN
        CREATE POLICY "Everyone can read offline_routing_settings"
        ON public.offline_routing_settings
        FOR SELECT
        TO authenticated
        USING (true);
    END IF;
END
$$;

-- Insert default row if none exists
INSERT INTO public.offline_routing_settings (is_enabled, target_sector_name)
SELECT true, 'Atendimento'
WHERE NOT EXISTS (SELECT 1 FROM public.offline_routing_settings);
