-- Modo teste (simulação): admin liga para si; o que ele cria fica marcado como teste e nada sai para fora
-- (WhatsApp/e-mail viram prévia em teste_envios; GSystem/Autentique são bloqueados com prévia).

CREATE TABLE IF NOT EXISTS public.modo_teste (
  user_id uuid PRIMARY KEY,
  ativo boolean NOT NULL DEFAULT false,
  desde timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.teste_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  canal text NOT NULL,            -- whatsapp | email | gsystem | autentique
  destino text,
  resumo text,
  conteudo text,
  bloqueado boolean NOT NULL DEFAULT false,
  detalhe jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS teste_envios_user_idx ON public.teste_envios (user_id, created_at DESC);

ALTER TABLE public.modo_teste ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teste_envios ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS modo_teste_proprio ON public.modo_teste;
CREATE POLICY modo_teste_proprio ON public.modo_teste FOR ALL TO authenticated
  USING (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (user_id = auth.uid() AND public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS teste_envios_ler ON public.teste_envios;
CREATE POLICY teste_envios_ler ON public.teste_envios FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
DROP POLICY IF EXISTS teste_envios_apagar ON public.teste_envios;
CREATE POLICY teste_envios_apagar ON public.teste_envios FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.modo_teste TO authenticated;
GRANT SELECT, DELETE ON public.teste_envios TO authenticated;
GRANT ALL ON public.modo_teste, public.teste_envios TO service_role;
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['modo_teste','teste_envios'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
  END LOOP;
END $$;

-- Quem está em modo teste agora?
CREATE OR REPLACE FUNCTION public.em_modo_teste(_user uuid DEFAULT auth.uid())
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT ativo FROM public.modo_teste WHERE user_id = _user), false)
$$;

-- Marca como teste tudo que um usuário em modo teste cria.
CREATE OR REPLACE FUNCTION public.marca_registro_teste()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND public.em_modo_teste(auth.uid()) THEN NEW.is_teste := true; END IF;
  RETURN NEW;
END $$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['service_tickets','technical_service_terms','crm_opportunities','crm_tasks','crm_proposal_links','contratos'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('ALTER TABLE public.%I ADD COLUMN IF NOT EXISTS is_teste boolean NOT NULL DEFAULT false', t);
    EXECUTE format('DROP TRIGGER IF EXISTS trg_marca_teste ON public.%I', t);
    EXECUTE format('CREATE TRIGGER trg_marca_teste BEFORE INSERT ON public.%I FOR EACH ROW EXECUTE FUNCTION public.marca_registro_teste()', t);
  END LOOP;
END $$;

-- Apaga os dados de teste (só admin). Ordem: dependentes primeiro; cada tabela isolada para um erro não travar as outras.
CREATE OR REPLACE FUNCTION public.limpar_dados_teste()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE t text; n int; res jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores.'; END IF;
  FOREACH t IN ARRAY ARRAY['crm_proposal_links','technical_service_terms','crm_tasks','crm_opportunities','contratos','service_tickets'] LOOP
    IF to_regclass('public.' || t) IS NULL THEN CONTINUE; END IF;
    BEGIN
      EXECUTE format('DELETE FROM public.%I WHERE is_teste', t);
      GET DIAGNOSTICS n = ROW_COUNT;
      res := res || jsonb_build_object(t, n);
    EXCEPTION WHEN others THEN
      res := res || jsonb_build_object(t, 'erro: ' || SQLERRM);
    END;
  END LOOP;
  DELETE FROM public.teste_envios;
  RETURN res;
END $$;
GRANT EXECUTE ON FUNCTION public.limpar_dados_teste() TO authenticated;
GRANT EXECUTE ON FUNCTION public.em_modo_teste(uuid) TO authenticated;
