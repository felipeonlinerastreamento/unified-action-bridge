-- =====================================================================
-- Módulo Financeiro (BPO Financeiro)
-- Acesso restrito a uma lista própria (fin_acesso): Felipe e Patrícia.
-- Ser admin NÃO basta. Todas as tabelas fin_* e o bucket usam can_access_finance().
-- =====================================================================

-- 1) Lista de acesso -----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fin_acesso (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_acesso ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_access_finance()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.fin_acesso a
    JOIN public.profiles p ON p.user_id = a.user_id
    WHERE a.user_id = auth.uid()
      AND COALESCE(p.is_active, true) = true
  );
$$;
REVOKE ALL ON FUNCTION public.can_access_finance() FROM public;
GRANT EXECUTE ON FUNCTION public.can_access_finance() TO authenticated;

-- Quem está na lista vê a lista; ninguém grava pelo app (só por migração).
DROP POLICY IF EXISTS "fin_acesso_select" ON public.fin_acesso;
CREATE POLICY "fin_acesso_select" ON public.fin_acesso
  FOR SELECT TO authenticated USING (public.can_access_finance());

INSERT INTO public.fin_acesso (user_id)
SELECT id FROM auth.users
WHERE lower(email) IN ('felipe@onlinerastreamento.com.br', 'contato.pats@gmail.com')
ON CONFLICT DO NOTHING;

-- 2) Empresas, categorias -------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fin_empresas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  codigo text NOT NULL UNIQUE,
  nome text NOT NULL,
  cnpj text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.fin_categorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL UNIQUE,
  tipo text NOT NULL DEFAULT 'despesa' CHECK (tipo IN ('despesa', 'receita')),
  grupo_dre text NOT NULL DEFAULT 'Despesas operacionais',
  ativo boolean NOT NULL DEFAULT true,
  ordem int NOT NULL DEFAULT 100,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Contas bancárias ------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.fin_contas_bancarias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  empresa_id uuid REFERENCES public.fin_empresas(id) ON DELETE SET NULL,
  nome text NOT NULL,
  banco text,
  agencia text,
  conta text,
  saldo_inicial numeric(14,2) NOT NULL DEFAULT 0,
  saldo_inicial_data date,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4) Lançamentos (contas a pagar e a receber) ------------------------------
CREATE TABLE IF NOT EXISTS public.fin_lancamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo text NOT NULL DEFAULT 'pagar' CHECK (tipo IN ('pagar', 'receber')),
  empresa_id uuid REFERENCES public.fin_empresas(id) ON DELETE SET NULL,
  conta_bancaria_id uuid REFERENCES public.fin_contas_bancarias(id) ON DELETE SET NULL,
  categoria_id uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  contraparte text,                -- fornecedor ou cliente
  documento_contraparte text,      -- CNPJ/CPF
  descricao text,
  valor numeric(14,2) NOT NULL DEFAULT 0,
  data_emissao date,
  vencimento date,
  competencia date,                -- 1º dia do mês de competência
  data_pagamento date,
  valor_pago numeric(14,2),
  status text NOT NULL DEFAULT 'aberto' CHECK (status IN ('aberto', 'pago', 'cancelado')),
  forma_pagamento text,
  tipo_documento text CHECK (tipo_documento IS NULL OR tipo_documento IN ('boleto', 'nota_fiscal', 'recibo', 'cupom_fiscal', 'guia', 'fatura', 'outro')),
  numero_documento text,
  linha_digitavel text,
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('drive', 'upload', 'manual', 'importacao')),
  drive_file_id text UNIQUE,
  arquivo_nome text,
  arquivo_url text,                -- link do Drive
  arquivo_path text,               -- caminho no bucket fin-comprovantes
  ia_confianca numeric(4,3),
  revisado boolean NOT NULL DEFAULT true,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_lancamentos_venc_idx ON public.fin_lancamentos (vencimento);
CREATE INDEX IF NOT EXISTS fin_lancamentos_comp_idx ON public.fin_lancamentos (competencia);
CREATE INDEX IF NOT EXISTS fin_lancamentos_revisado_idx ON public.fin_lancamentos (revisado) WHERE revisado = false;

CREATE OR REPLACE FUNCTION public.fin_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.competencia IS NULL THEN
    NEW.competencia := date_trunc('month', COALESCE(NEW.data_emissao, NEW.vencimento, now()::date))::date;
  ELSE
    NEW.competencia := date_trunc('month', NEW.competencia)::date;
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fin_lancamentos_touch ON public.fin_lancamentos;
CREATE TRIGGER fin_lancamentos_touch BEFORE INSERT OR UPDATE ON public.fin_lancamentos
  FOR EACH ROW EXECUTE FUNCTION public.fin_touch_updated_at();

-- 5) Extrato bancário (conciliação) ----------------------------------------
CREATE TABLE IF NOT EXISTS public.fin_extrato_itens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conta_bancaria_id uuid NOT NULL REFERENCES public.fin_contas_bancarias(id) ON DELETE CASCADE,
  data date NOT NULL,
  valor numeric(14,2) NOT NULL,     -- negativo = saída
  descricao text,
  documento text,
  fit_id text,                      -- id do banco (OFX), evita duplicar
  lancamento_id uuid REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  conciliado_em timestamptz,
  conciliado_por uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (conta_bancaria_id, fit_id)
);

-- 6) RLS: tudo exige can_access_finance() ----------------------------------
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin_empresas','fin_categorias','fin_contas_bancarias','fin_lancamentos','fin_extrato_itens']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance())',
      t || '_all', t
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    -- Padrão do projeto: política RESTRICTIVE "Only active staff" em toda tabela nova.
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())',
      'Only active staff', t
    );
  END LOOP;
END $$;
DROP POLICY IF EXISTS "Only active staff" ON public.fin_acesso;
CREATE POLICY "Only active staff" ON public.fin_acesso AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT SELECT ON public.fin_acesso TO authenticated;

-- 7) Bucket privado para comprovantes --------------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('fin-comprovantes', 'fin-comprovantes', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "fin_comprovantes_select" ON storage.objects;
CREATE POLICY "fin_comprovantes_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fin-comprovantes' AND public.can_access_finance());
DROP POLICY IF EXISTS "fin_comprovantes_insert" ON storage.objects;
CREATE POLICY "fin_comprovantes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fin-comprovantes' AND public.can_access_finance());
DROP POLICY IF EXISTS "fin_comprovantes_delete" ON storage.objects;
CREATE POLICY "fin_comprovantes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fin-comprovantes' AND public.can_access_finance());

-- 8) Dados iniciais ---------------------------------------------------------
-- OT: empresa usada para dividir o faturamento, já encerrada. Fica inativa (não aparece em
-- lançamentos novos), mas continua ligando os comprovantes antigos com "OT" no nome do arquivo.
INSERT INTO public.fin_empresas (codigo, nome, cnpj, ativo) VALUES
  ('OR', 'Online Rastreamento Ltda', '22.632.188/0001-23', true),
  ('OT', 'OT (empresa encerrada)', NULL, false)
ON CONFLICT (codigo) DO NOTHING;

INSERT INTO public.fin_categorias (nome, tipo, grupo_dre, ordem) VALUES
  ('Receita de mensalidades', 'receita', 'Receita bruta', 1),
  ('Receita de instalação e serviços', 'receita', 'Receita bruta', 2),
  ('Outras receitas', 'receita', 'Outras receitas', 3),
  ('Equipamentos (rastreadores)', 'despesa', 'Custo dos serviços', 10),
  ('Chips e telecom', 'despesa', 'Custo dos serviços', 11),
  ('Plataformas e software', 'despesa', 'Custo dos serviços', 12),
  ('Serviços de terceiros', 'despesa', 'Custo dos serviços', 13),
  ('Impostos e tributos', 'despesa', 'Impostos', 20),
  ('Folha e pró-labore', 'despesa', 'Pessoal', 30),
  ('Alimentação', 'despesa', 'Despesas operacionais', 40),
  ('Almoço com cliente', 'despesa', 'Despesas comerciais', 41),
  ('Marketing', 'despesa', 'Despesas comerciais', 42),
  ('Combustível e deslocamento', 'despesa', 'Despesas operacionais', 43),
  ('Aluguel e condomínio', 'despesa', 'Despesas administrativas', 50),
  ('Energia/água/internet', 'despesa', 'Despesas administrativas', 51),
  ('Limpeza do escritório', 'despesa', 'Despesas administrativas', 52),
  ('Reforma e manutenção predial', 'despesa', 'Despesas administrativas', 53),
  ('Seguros', 'despesa', 'Despesas administrativas', 54),
  ('Tarifas bancárias', 'despesa', 'Despesas financeiras', 60),
  ('Outros', 'despesa', 'Outras despesas', 99)
ON CONFLICT (nome) DO NOTHING;

-- Contas bancárias da Online Rastreamento (saldo inicial é ajustado na tela de Conciliação).
INSERT INTO public.fin_contas_bancarias (empresa_id, nome, banco)
SELECT e.id, v.nome, v.banco
FROM public.fin_empresas e
CROSS JOIN (VALUES ('Itaú PJ', 'Itaú'), ('Bradesco PJ', 'Bradesco'), ('Inter PJ', 'Inter')) AS v(nome, banco)
WHERE e.codigo = 'OR'
  AND NOT EXISTS (SELECT 1 FROM public.fin_contas_bancarias c WHERE c.nome = v.nome);

-- 9) Papéis: admins (exceto Felipe e Patrícia) passam a gestor --------------
-- Confirmado pelo usuário em 21/11/2026: Ricardo, Giseli, Marcus e Wellington.
INSERT INTO public.user_roles (user_id, role)
SELECT ur.user_id, 'gestor'::public.app_role
FROM public.user_roles ur
JOIN auth.users u ON u.id = ur.user_id
WHERE ur.role = 'admin'
  AND lower(u.email) NOT IN ('felipe@onlinerastreamento.com.br', 'contato.pats@gmail.com')
ON CONFLICT DO NOTHING;

DELETE FROM public.user_roles ur
USING auth.users u
WHERE u.id = ur.user_id
  AND ur.role = 'admin'
  AND lower(u.email) NOT IN ('felipe@onlinerastreamento.com.br', 'contato.pats@gmail.com');
