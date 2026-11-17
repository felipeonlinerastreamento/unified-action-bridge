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
  SELECT name INTO _uname FROM profiles WHERE user_id=auth.uid() LIMIT 1;
  SELECT serie, raw->>'Modelo' AS modelo, raw->>'Chip' AS chip INTO _eq FROM gsystem_equipamentos WHERE codigo::text=_codigo LIMIT 1;
  INSERT INTO gsystem_vinculos_historico(operacao, equipamento_codigo, equipamento_serie, equipamento_modelo, chip, acessorios, user_id, user_name)
  VALUES (CASE WHEN _delta>0 THEN 'kit_adicionar' ELSE 'kit_remover' END, _codigo, _eq.serie, _eq.modelo, _eq.chip,
    jsonb_build_object('accessory_id',_accessory,'nome',_name,'de',_old,'para',_qtd), auth.uid(), _uname);
END $$;