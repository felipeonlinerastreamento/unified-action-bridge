CREATE TABLE public.teste_equipamento_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  trigger_category_key text NOT NULL DEFAULT 'Teste de Equipamento',
  trigger_category_label text NOT NULL DEFAULT 'Teste de Equipamento',
  target_sector_name text NOT NULL DEFAULT 'Administrativo',
  target_status text NOT NULL DEFAULT 'aberto',
  auto_sync_gsystem boolean NOT NULL DEFAULT true,
  require_subtipo boolean NOT NULL DEFAULT true,
  require_motivo_when_cobrar boolean NOT NULL DEFAULT true,
  require_garantia boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

ALTER TABLE public.teste_equipamento_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view teste equipamento settings"
  ON public.teste_equipamento_settings
  FOR SELECT
  TO authenticated
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage teste equipamento settings"
  ON public.teste_equipamento_settings
  FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_teste_equipamento_settings_updated_at
  BEFORE UPDATE ON public.teste_equipamento_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.teste_equipamento_settings (id) VALUES (gen_random_uuid());