CREATE TABLE public.crm_service_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT '',
  unit text NOT NULL DEFAULT 'Serviço',
  default_activation numeric NOT NULL DEFAULT 0,
  default_monthly numeric NOT NULL DEFAULT 0,
  category_id uuid REFERENCES public.crm_categories(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_service_catalog TO authenticated;
GRANT ALL ON public.crm_service_catalog TO service_role;

ALTER TABLE public.crm_service_catalog ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view services" ON public.crm_service_catalog
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can manage services" ON public.crm_service_catalog
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role) OR has_role(auth.uid(),'gestor'::app_role));

CREATE TRIGGER update_crm_service_catalog_updated_at
  BEFORE UPDATE ON public.crm_service_catalog
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.crm_service_catalog (name, description, unit, default_activation, default_monthly, position) VALUES
('Vídeo monitoramento (interno e externo)', 'Vídeo monitoramento inteligente com IA, gravação interna e externa.', 'Serviço', 500, 230, 1),
('Sensor de fadiga (câmera externa)', 'Detecção de fadiga e distração com alertas em tempo real e relatórios de comportamento.', 'Serviço', 580, 268, 2),
('Rastreamento 2G com identificador iButton', 'Rastreamento veicular 2G com identificação de motorista via iButton.', 'Serviço', 100, 54.90, 3),
('Gestão de multas', 'Acompanhamento e gestão de multas de trânsito por placa.', 'Placa', 0, 12.90, 4),
('Otimizador de rotas', 'Planejamento e otimização de rotas por placa.', 'Placa', 0, 15.90, 5),
('Controle de manutenção avançado', 'Controle avançado de manutenções preventivas por placa.', 'Placa', 0, 12.90, 6);