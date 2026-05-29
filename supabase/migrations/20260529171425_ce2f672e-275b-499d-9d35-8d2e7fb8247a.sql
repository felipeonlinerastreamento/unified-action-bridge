-- Tabela de vínculo N:N entre sub-itens e modelos de equipamento
CREATE TABLE public.ticket_subcategory_equipment_models (
  subcategory_id uuid NOT NULL REFERENCES public.ticket_subcategories(id) ON DELETE CASCADE,
  equipment_item_id uuid NOT NULL REFERENCES public.liberacao_equipamento_items(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (subcategory_id, equipment_item_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_subcategory_equipment_models TO authenticated;
GRANT ALL ON public.ticket_subcategory_equipment_models TO service_role;

ALTER TABLE public.ticket_subcategory_equipment_models ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read subcategory equipment models"
ON public.ticket_subcategory_equipment_models FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins can insert subcategory equipment models"
ON public.ticket_subcategory_equipment_models FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update subcategory equipment models"
ON public.ticket_subcategory_equipment_models FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete subcategory equipment models"
ON public.ticket_subcategory_equipment_models FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_tsem_subcategory ON public.ticket_subcategory_equipment_models(subcategory_id);
CREATE INDEX idx_tsem_equipment ON public.ticket_subcategory_equipment_models(equipment_item_id);

-- Colunas no service_tickets para guardar o modelo escolhido no chamado
ALTER TABLE public.service_tickets
  ADD COLUMN equipment_model_id uuid REFERENCES public.liberacao_equipamento_items(id) ON DELETE SET NULL,
  ADD COLUMN equipment_model_name text;

CREATE INDEX idx_service_tickets_equipment_model ON public.service_tickets(equipment_model_id);