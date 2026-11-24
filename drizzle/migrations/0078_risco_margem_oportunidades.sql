-- Risco de cancelamento por cliente, margem real por cliente e oportunidades criadas pela IA a partir das conversas.

-- 1) Risco de cancelamento (Pós-venda › carteira)
ALTER TABLE public.crm_posvenda_carteira
  ADD COLUMN IF NOT EXISTS risco_nota int,
  ADD COLUMN IF NOT EXISTS risco_nivel text,
  ADD COLUMN IF NOT EXISTS risco_motivos jsonb,
  ADD COLUMN IF NOT EXISTS risco_em timestamptz,
  ADD COLUMN IF NOT EXISTS chamados_90d int,
  ADD COLUMN IF NOT EXISTS chamados_atrasados int;
CREATE INDEX IF NOT EXISTS crm_posvenda_carteira_risco_idx ON public.crm_posvenda_carteira (risco_nota DESC NULLS LAST);

-- 2) Parâmetros de custo da margem por cliente (Financeiro)
CREATE TABLE IF NOT EXISTS public.margem_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  custo_chip_mensal numeric NOT NULL DEFAULT 10,
  vida_util_meses int NOT NULL DEFAULT 36,
  custo_equipamento_padrao numeric NOT NULL DEFAULT 250,
  custo_visita numeric NOT NULL DEFAULT 120,
  custo_chamado numeric NOT NULL DEFAULT 12,
  imposto_pct numeric NOT NULL DEFAULT 0,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.margem_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE t text := 'margem_config';
BEGIN
  EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
  EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance())', t || '_all', t);
  EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
  EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
  EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
END $$;

-- 3) IA de oportunidades nas conversas (Configurações › Assistente IA)
ALTER TABLE public.ai_assistant_config
  ADD COLUMN IF NOT EXISTS ia_oportunidades_ativo boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS ia_oportunidades_confianca numeric NOT NULL DEFAULT 0.6;
