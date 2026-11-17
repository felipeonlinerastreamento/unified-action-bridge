CREATE TABLE public.accessory_catalog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  tipo text,
  modelo text,
  saldo integer NOT NULL DEFAULT 0,
  estoque_minimo integer NOT NULL DEFAULT 0,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accessory_catalog TO authenticated;
GRANT ALL ON public.accessory_catalog TO service_role;
ALTER TABLE public.accessory_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read accessories" ON public.accessory_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "managers write accessories" ON public.accessory_catalog FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_accessory_catalog_updated BEFORE UPDATE ON public.accessory_catalog FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.equipment_kit_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  equipamento_codigo text NOT NULL,
  accessory_id uuid NOT NULL REFERENCES public.accessory_catalog(id) ON DELETE RESTRICT,
  quantidade integer NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (equipamento_codigo, accessory_id)
);
GRANT SELECT ON public.equipment_kit_items TO authenticated;
GRANT ALL ON public.equipment_kit_items TO service_role;
ALTER TABLE public.equipment_kit_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read kit" ON public.equipment_kit_items FOR SELECT TO authenticated USING (true);

CREATE TABLE public.gsystem_vinculos_historico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  operacao text NOT NULL,
  equipamento_codigo text,
  equipamento_serie text,
  equipamento_modelo text,
  chip text,
  veiculo_codigo text,
  placa text,
  acessorios jsonb,
  sucesso boolean NOT NULL DEFAULT true,
  erro text,
  user_id uuid,
  user_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.gsystem_vinculos_historico TO authenticated;
GRANT ALL ON public.gsystem_vinculos_historico TO service_role;
ALTER TABLE public.gsystem_vinculos_historico ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read historico" ON public.gsystem_vinculos_historico FOR SELECT TO authenticated USING (true);
CREATE INDEX idx_vinc_hist_equip ON public.gsystem_vinculos_historico(equipamento_codigo, created_at DESC);

-- Atomic kit update: sets quantity for one accessory on one equipment, adjusts saldo, logs history
CREATE OR REPLACE FUNCTION public.set_equipment_kit_item(_codigo text, _accessory uuid, _qtd integer)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _old integer := 0; _delta integer; _saldo integer; _name text; _uname text; _eq record;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  IF _qtd < 0 THEN RAISE EXCEPTION 'Quantidade inválida'; END IF;
  SELECT quantidade INTO _old FROM equipment_kit_items WHERE equipamento_codigo=_codigo AND accessory_id=_accessory FOR UPDATE;
  _old := COALESCE(_old,0);
  _delta := _qtd - _old;
  IF _delta = 0 THEN RETURN; END IF;
  SELECT saldo, name INTO _saldo, _name FROM accessory_catalog WHERE id=_accessory FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Acessório não encontrado'; END IF;
  IF _delta > 0 AND _saldo < _delta THEN RAISE EXCEPTION 'Saldo insuficiente de % (disponível: %)', _name, _saldo; END IF;
  UPDATE accessory_catalog SET saldo = saldo - _delta WHERE id=_accessory;
  IF _qtd = 0 THEN
    DELETE FROM equipment_kit_items WHERE equipamento_codigo=_codigo AND accessory_id=_accessory;
  ELSE
    INSERT INTO equipment_kit_items(equipamento_codigo, accessory_id, quantidade, updated_by, updated_at)
    VALUES (_codigo,_accessory,_qtd,auth.uid(),now())
    ON CONFLICT (equipamento_codigo, accessory_id) DO UPDATE SET quantidade=EXCLUDED.quantidade, updated_by=EXCLUDED.updated_by, updated_at=now();
  END IF;
  SELECT COALESCE(display_name, full_name, email) INTO _uname FROM profiles WHERE user_id=auth.uid() LIMIT 1;
  SELECT serie, raw->>'Modelo' AS modelo, raw->>'Chip' AS chip INTO _eq FROM gsystem_equipamentos WHERE codigo::text=_codigo LIMIT 1;
  INSERT INTO gsystem_vinculos_historico(operacao, equipamento_codigo, equipamento_serie, equipamento_modelo, chip, acessorios, user_id, user_name)
  VALUES (CASE WHEN _delta>0 THEN 'kit_adicionar' ELSE 'kit_remover' END, _codigo, _eq.serie, _eq.modelo, _eq.chip,
    jsonb_build_object('accessory_id',_accessory,'nome',_name,'de',_old,'para',_qtd), auth.uid(), _uname);
END $$;
REVOKE ALL ON FUNCTION public.set_equipment_kit_item(text,uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_equipment_kit_item(text,uuid,integer) TO authenticated;