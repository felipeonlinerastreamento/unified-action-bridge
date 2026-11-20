CREATE TABLE public.technical_term_types (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text NOT NULL UNIQUE CHECK (key ~ '^[a-z0-9_]{2,40}$' AND key NOT IN ('none', 'escolher')),
  label text NOT NULL,
  title text NOT NULL,
  body text NOT NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  requires_equipment_id boolean NOT NULL DEFAULT false,
  whatsapp_template text NOT NULL DEFAULT 'Olá {responsavel}! A {empresa} precisa do seu aceite para o serviço de {servico} no veículo {placa}. Acesse: {link}',
  email_subject text NOT NULL DEFAULT '{servico} — aceite necessário ({placa})',
  email_template text NOT NULL DEFAULT E'Olá {responsavel},\n\nPara agendarmos o serviço de {servico} no veículo {placa} ({cliente}), precisamos do seu aceite no termo abaixo:\n\n{link}',
  is_active boolean NOT NULL DEFAULT true,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technical_term_types TO authenticated;
GRANT ALL ON public.technical_term_types TO service_role;

ALTER TABLE public.technical_term_types ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read technical term types" ON public.technical_term_types
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers manage technical term types" ON public.technical_term_types
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- Tipos atuais com os textos e mensagens já configurados
INSERT INTO public.technical_term_types (key, label, title, body, checklist, requires_equipment_id, whatsapp_template, email_subject, email_template, position)
SELECT v.key, v.label, v.title, v.body, v.checklist, v.req_equipment, s.whatsapp_template, s.email_subject, s.email_template, v.pos
  FROM public.technical_term_settings s
  CROSS JOIN LATERAL (VALUES
    ('instalacao', 'Instalação', s.instalacao_title, s.instalacao_text, COALESCE(s.instalacao_checklist, '[]'::jsonb), false, 1),
    ('manutencao', 'Manutenção', s.manutencao_title, s.manutencao_text, COALESCE(s.manutencao_checklist, '[]'::jsonb), false, 2),
    ('retirada', 'Retirada', s.retirada_title, s.retirada_text, COALESCE(s.retirada_checklist, '[]'::jsonb), true, 3)
  ) AS v(key, label, title, body, checklist, req_equipment, pos)
 WHERE s.id = 'default'
ON CONFLICT (key) DO NOTHING;

COMMENT ON COLUMN public.technical_term_settings.instalacao_title IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.instalacao_text IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.instalacao_checklist IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.manutencao_title IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.manutencao_text IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.manutencao_checklist IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.retirada_title IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.retirada_text IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.retirada_checklist IS 'DEPRECATED: replaced by technical_term_types';
COMMENT ON COLUMN public.technical_term_settings.whatsapp_template IS 'DEPRECATED: replaced by technical_term_types.whatsapp_template';
COMMENT ON COLUMN public.technical_term_settings.email_subject IS 'DEPRECATED: replaced by technical_term_types.email_subject';
COMMENT ON COLUMN public.technical_term_settings.email_template IS 'DEPRECATED: replaced by technical_term_types.email_template';

-- Nome do serviço congelado no termo enviado
ALTER TABLE public.technical_service_terms ADD COLUMN IF NOT EXISTS service_label text;
UPDATE public.technical_service_terms t
   SET service_label = tt.label
  FROM public.technical_term_types tt
 WHERE tt.key = t.service_type AND t.service_label IS NULL;

-- Tipos deixam de ser fixos: validação pelo catálogo
ALTER TABLE public.technical_service_terms DROP CONSTRAINT IF EXISTS technical_service_terms_service_type_check;
ALTER TABLE public.ticket_categories DROP CONSTRAINT IF EXISTS ticket_categories_technical_term_type_check;

CREATE OR REPLACE FUNCTION public.validate_term_service_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.service_type IS NOT DISTINCT FROM OLD.service_type THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.technical_term_types WHERE key = NEW.service_type) THEN
    RAISE EXCEPTION 'Tipo de termo inexistente: %', NEW.service_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_term_service_type
  BEFORE INSERT OR UPDATE OF service_type ON public.technical_service_terms
  FOR EACH ROW EXECUTE FUNCTION public.validate_term_service_type();

CREATE OR REPLACE FUNCTION public.validate_category_term_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.technical_term_type IS NULL THEN
    NEW.technical_term_type := 'none';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.technical_term_type IS NOT DISTINCT FROM OLD.technical_term_type THEN
    RETURN NEW;
  END IF;
  IF NEW.technical_term_type IN ('none', 'escolher') THEN
    RETURN NEW;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.technical_term_types WHERE key = NEW.technical_term_type AND is_active) THEN
    RAISE EXCEPTION 'Tipo de termo inexistente ou inativo: %', NEW.technical_term_type;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_validate_category_term_type
  BEFORE INSERT OR UPDATE OF technical_term_type ON public.ticket_categories
  FOR EACH ROW EXECUTE FUNCTION public.validate_category_term_type();

-- Proteções do catálogo: chave imutável; não inativar tipo exigido por categoria
CREATE OR REPLACE FUNCTION public.guard_technical_term_type()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_cats text;
BEGIN
  IF NEW.key IS DISTINCT FROM OLD.key THEN
    RAISE EXCEPTION 'O identificador do tipo de termo não pode ser alterado.';
  END IF;
  IF OLD.is_active AND NOT NEW.is_active THEN
    SELECT string_agg(label, ', ' ORDER BY label) INTO v_cats
      FROM public.ticket_categories WHERE technical_term_type = OLD.key;
    IF v_cats IS NOT NULL THEN
      RAISE EXCEPTION 'Este termo é exigido pelas categorias: %. Altere-as em Encaminhamento antes de inativar.', v_cats;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_guard_technical_term_type
  BEFORE UPDATE ON public.technical_term_types
  FOR EACH ROW EXECUTE FUNCTION public.guard_technical_term_type();

REVOKE ALL ON FUNCTION public.validate_term_service_type() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.validate_category_term_type() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.guard_technical_term_type() FROM PUBLIC, anon, authenticated;

-- Excluir: se já usado em termo, apenas inativa
CREATE OR REPLACE FUNCTION public.delete_technical_term_type(_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_key text;
  v_cats text;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role)) THEN
    RAISE EXCEPTION 'Apenas administradores e gestores podem excluir termos.';
  END IF;
  SELECT key INTO v_key FROM public.technical_term_types WHERE id = _id;
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Tipo de termo não encontrado.';
  END IF;
  SELECT string_agg(label, ', ' ORDER BY label) INTO v_cats
    FROM public.ticket_categories WHERE technical_term_type = v_key;
  IF v_cats IS NOT NULL THEN
    RAISE EXCEPTION 'Este termo é exigido pelas categorias: %. Altere-as em Encaminhamento antes de excluir.', v_cats;
  END IF;
  IF EXISTS (SELECT 1 FROM public.technical_service_terms WHERE service_type = v_key) THEN
    UPDATE public.technical_term_types SET is_active = false, updated_by = auth.uid() WHERE id = _id;
    RETURN 'inativado';
  END IF;
  DELETE FROM public.technical_term_types WHERE id = _id;
  RETURN 'excluido';
END;
$$;
REVOKE ALL ON FUNCTION public.delete_technical_term_type(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_technical_term_type(uuid) TO authenticated;