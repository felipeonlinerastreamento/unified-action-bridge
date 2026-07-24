
CREATE TABLE public.gsystem_equipamentos (
  codigo integer PRIMARY KEY,
  display_name text,
  equipamento text,
  serie text,
  observacao text,
  comunicacao text,
  empresa jsonb,
  parametros jsonb,
  raw jsonb,
  synced_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_gsystem_equip_serie ON public.gsystem_equipamentos (lower(serie));
CREATE INDEX idx_gsystem_equip_display ON public.gsystem_equipamentos (lower(display_name));
CREATE INDEX idx_gsystem_equip_equipamento ON public.gsystem_equipamentos (lower(equipamento));

GRANT SELECT ON public.gsystem_equipamentos TO authenticated;
GRANT ALL ON public.gsystem_equipamentos TO service_role;
ALTER TABLE public.gsystem_equipamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view gsystem equipamentos" ON public.gsystem_equipamentos
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);

CREATE TABLE public.gsystem_sync_status (
  id text PRIMARY KEY,
  last_started_at timestamptz,
  last_finished_at timestamptz,
  last_success_at timestamptz,
  items_count integer,
  last_error text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gsystem_sync_status TO authenticated;
GRANT ALL ON public.gsystem_sync_status TO service_role;
ALTER TABLE public.gsystem_sync_status ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view sync status" ON public.gsystem_sync_status
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
