-- =====================================================================
-- CRM › Pós-venda: carteira de clientes (curva ABC pela receita das faturas do GSystem)
-- e registro de cada contato do pós-venda. Acesso pela aba 'posvenda' (crm_tab_allowed).
-- A carteira é montada no servidor (service role) a partir do Financeiro; o pós-venda
-- não precisa de acesso ao Financeiro para trabalhar.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.crm_posvenda_carteira (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento text NOT NULL UNIQUE,          -- CPF/CNPJ só números
  nome text NOT NULL,
  gsystem_cliente_key text,
  receita_mensal numeric(14,2) NOT NULL DEFAULT 0,   -- média dos últimos 3 meses de faturas
  vencidas_valor numeric(14,2) NOT NULL DEFAULT 0,
  vencidas_qtd int NOT NULL DEFAULT 0,
  primeira_fatura_em date,
  classe text NOT NULL DEFAULT 'C' CHECK (classe IN ('A','B','C')),
  classe_manual text CHECK (classe_manual IS NULL OR classe_manual IN ('A','B','C')),
  responsavel_id uuid,                     -- auth user id do pós-venda
  ultimo_contato_em date,
  proximo_contato_em date,
  ultimo_nps int CHECK (ultimo_nps IS NULL OR ultimo_nps BETWEEN 0 AND 10),
  ultimo_sentimento text CHECK (ultimo_sentimento IS NULL OR ultimo_sentimento IN ('positivo','neutro','negativo')),
  observacoes text,
  -- Diagnóstico do primeiro contato (toda a base PJ entra na carteira para esse contato)
  frota_total int,                         -- veículos que a empresa tem (rastreados ou não)
  decisor_nome text,
  decisor_telefone text,
  interesses text[] NOT NULL DEFAULT '{}', -- ex.: camera, telemetria, bafometro, mais_veiculos
  diagnostico_em date,
  ativo boolean NOT NULL DEFAULT true,
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_posvenda_carteira_prox_idx ON public.crm_posvenda_carteira (proximo_contato_em) WHERE ativo;

CREATE TABLE IF NOT EXISTS public.crm_posvenda_contatos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  carteira_id uuid NOT NULL REFERENCES public.crm_posvenda_carteira(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT ((now() AT TIME ZONE 'America/Sao_Paulo')::date),
  canal text NOT NULL DEFAULT 'whatsapp',
  roteiro text NOT NULL DEFAULT 'revisao',
  resultado text NOT NULL DEFAULT 'realizado' CHECK (resultado IN ('realizado','sem_resposta','reagendado')),
  resumo text NOT NULL DEFAULT '',
  sentimento text CHECK (sentimento IS NULL OR sentimento IN ('positivo','neutro','negativo')),
  nps int CHECK (nps IS NULL OR nps BETWEEN 0 AND 10),
  proximo_passo text,
  proximo_contato_em date,
  oportunidade text,
  oportunidade_valor numeric(14,2),
  frota_total int,
  decisor_nome text,
  decisor_telefone text,
  interesses text[],
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS crm_posvenda_contatos_cart_idx ON public.crm_posvenda_contatos (carteira_id, data DESC);
CREATE INDEX IF NOT EXISTS crm_posvenda_contatos_data_idx ON public.crm_posvenda_contatos (data);

-- Ao registrar um contato, a carteira guarda último contato, NPS, sentimento e o próximo contato
-- (o informado; senão último + cadência da classe: A 15, B 30, C 90 dias).
CREATE OR REPLACE FUNCTION public.crm_posvenda_apos_contato()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  cls text;
  cad int;
BEGIN
  SELECT COALESCE(classe_manual, classe) INTO cls FROM public.crm_posvenda_carteira WHERE id = NEW.carteira_id;
  cad := CASE cls WHEN 'A' THEN 15 WHEN 'B' THEN 30 ELSE 90 END;
  IF NEW.resultado = 'realizado' THEN
    UPDATE public.crm_posvenda_carteira SET
      ultimo_contato_em = GREATEST(COALESCE(ultimo_contato_em, NEW.data), NEW.data),
      ultimo_nps = COALESCE(NEW.nps, ultimo_nps),
      ultimo_sentimento = COALESCE(NEW.sentimento, ultimo_sentimento),
      proximo_contato_em = COALESCE(NEW.proximo_contato_em, NEW.data + cad),
      frota_total = COALESCE(NEW.frota_total, frota_total),
      decisor_nome = COALESCE(NULLIF(NEW.decisor_nome, ''), decisor_nome),
      decisor_telefone = COALESCE(NULLIF(NEW.decisor_telefone, ''), decisor_telefone),
      interesses = CASE WHEN NEW.interesses IS NULL THEN interesses ELSE NEW.interesses END,
      diagnostico_em = CASE WHEN NEW.roteiro = 'primeiro_contato' THEN NEW.data ELSE diagnostico_em END,
      atualizado_em = now()
    WHERE id = NEW.carteira_id;
  ELSE
    -- Sem resposta / reagendado: tenta de novo na data informada ou em 2 dias.
    UPDATE public.crm_posvenda_carteira SET
      proximo_contato_em = COALESCE(NEW.proximo_contato_em, NEW.data + 2),
      atualizado_em = now()
    WHERE id = NEW.carteira_id;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crm_posvenda_contatos_apos ON public.crm_posvenda_contatos;
CREATE TRIGGER crm_posvenda_contatos_apos AFTER INSERT ON public.crm_posvenda_contatos
  FOR EACH ROW EXECUTE FUNCTION public.crm_posvenda_apos_contato();

-- RLS: quem tem a aba Pós-venda (admin/gestor sempre). Contatos: só o autor ou admin/gestor apagam.
ALTER TABLE public.crm_posvenda_carteira ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crm_posvenda_contatos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "posvenda_carteira_select" ON public.crm_posvenda_carteira;
CREATE POLICY "posvenda_carteira_select" ON public.crm_posvenda_carteira FOR SELECT TO authenticated
  USING (public.crm_tab_allowed('posvenda'));
DROP POLICY IF EXISTS "posvenda_carteira_update" ON public.crm_posvenda_carteira;
CREATE POLICY "posvenda_carteira_update" ON public.crm_posvenda_carteira FOR UPDATE TO authenticated
  USING (public.crm_tab_allowed('posvenda')) WITH CHECK (public.crm_tab_allowed('posvenda'));

DROP POLICY IF EXISTS "posvenda_contatos_select" ON public.crm_posvenda_contatos;
CREATE POLICY "posvenda_contatos_select" ON public.crm_posvenda_contatos FOR SELECT TO authenticated
  USING (public.crm_tab_allowed('posvenda'));
DROP POLICY IF EXISTS "posvenda_contatos_insert" ON public.crm_posvenda_contatos;
CREATE POLICY "posvenda_contatos_insert" ON public.crm_posvenda_contatos FOR INSERT TO authenticated
  WITH CHECK (public.crm_tab_allowed('posvenda') AND user_id = auth.uid());
DROP POLICY IF EXISTS "posvenda_contatos_update" ON public.crm_posvenda_contatos;
CREATE POLICY "posvenda_contatos_update" ON public.crm_posvenda_contatos FOR UPDATE TO authenticated
  USING (public.crm_tab_allowed('posvenda') AND (user_id = auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor')))
  WITH CHECK (public.crm_tab_allowed('posvenda'));
DROP POLICY IF EXISTS "posvenda_contatos_delete" ON public.crm_posvenda_contatos;
CREATE POLICY "posvenda_contatos_delete" ON public.crm_posvenda_contatos FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['crm_posvenda_carteira','crm_posvenda_contatos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
  END LOOP;
END $$;
GRANT SELECT, UPDATE ON public.crm_posvenda_carteira TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.crm_posvenda_contatos TO authenticated;
GRANT ALL ON public.crm_posvenda_carteira, public.crm_posvenda_contatos TO service_role;
