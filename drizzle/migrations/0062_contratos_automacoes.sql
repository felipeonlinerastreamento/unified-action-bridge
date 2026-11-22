-- =====================================================================
-- Contratos: regras automáticas (Configurações › Contratos).
-- - lembrete de assinatura pendente, aviso de vencimento, rascunho a partir da proposta
--   aceita, conferência com o Financeiro e reajuste anual pelo índice;
-- - rotina diária chamada pelo pg_cron (hook /api/public/hooks/contratos-diario).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.contratos_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  lembrete_ativo boolean NOT NULL DEFAULT true,
  lembrete_dias int[] NOT NULL DEFAULT '{3,7}',
  lembrete_modo text NOT NULL DEFAULT 'whatsapp' CHECK (lembrete_modo IN ('autentique','whatsapp','email','whatsapp_email')),
  lembrete_avisar_responsavel boolean NOT NULL DEFAULT true,
  vencimento_ativo boolean NOT NULL DEFAULT true,
  vencimento_dias int[] NOT NULL DEFAULT '{60,30}',
  vencimento_avisar_responsavel boolean NOT NULL DEFAULT true,
  vencimento_avisar_usuarios uuid[] NOT NULL DEFAULT '{}',
  vencimento_fornecedores boolean NOT NULL DEFAULT true,
  proposta_cria_rascunho boolean NOT NULL DEFAULT true,
  financeiro_tolerancia_pct numeric(6,2) NOT NULL DEFAULT 5,
  reajuste_ativo boolean NOT NULL DEFAULT true,
  reajuste_indice text NOT NULL DEFAULT 'IPCA' CHECK (reajuste_indice IN ('IPCA','IGPM','INPC','FIXO')),
  reajuste_fixo_pct numeric(6,2) NOT NULL DEFAULT 0,
  reajuste_aviso_dias int NOT NULL DEFAULT 30,
  reajuste_mensagem text NOT NULL DEFAULT 'Olá, {contato}! Conforme o contrato nº {numero}, a mensalidade de {cliente} será reajustada em {percentual} ({indice} acumulado em 12 meses) a partir de {data}: de {valor_atual} para {valor_novo}. Qualquer dúvida, estamos à disposição.',
  indices jsonb NOT NULL DEFAULT '{}'::jsonb,          -- { IPCA: { pct, ate, atualizado_em }, ... }
  ultima_rotina_em timestamptz,
  ultima_rotina_resumo jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.contratos_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.contratos_config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "contratos_config_select" ON public.contratos_config;
CREATE POLICY "contratos_config_select" ON public.contratos_config FOR SELECT TO authenticated USING (public.contratos_allowed());
DROP POLICY IF EXISTS "contratos_config_update" ON public.contratos_config;
CREATE POLICY "contratos_config_update" ON public.contratos_config FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
DROP POLICY IF EXISTS "Only active staff" ON public.contratos_config;
CREATE POLICY "Only active staff" ON public.contratos_config AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT SELECT, UPDATE ON public.contratos_config TO authenticated;
GRANT ALL ON public.contratos_config TO service_role;

ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS lembretes_enviados int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultimo_lembrete_em timestamptz,
  ADD COLUMN IF NOT EXISTS avisos_enviados jsonb NOT NULL DEFAULT '{}'::jsonb,   -- chaves de vencimento/reajuste já avisadas
  ADD COLUMN IF NOT EXISTS valor_mensal_atual numeric(14,2),                    -- depois dos reajustes
  ADD COLUMN IF NOT EXISTS reajustes jsonb NOT NULL DEFAULT '[]'::jsonb,          -- [{ data, indice, pct, de, para, por, em }]
  ADD COLUMN IF NOT EXISTS proposta_link_id uuid;
CREATE UNIQUE INDEX IF NOT EXISTS contratos_proposta_link_uq ON public.contratos (proposta_link_id) WHERE proposta_link_id IS NOT NULL;

-- Token da rotina diária (só service role / postgres lê).
CREATE TABLE IF NOT EXISTS public.contratos_cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos_cron_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contratos_cron_token FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.contratos_cron_token TO service_role;
DROP POLICY IF EXISTS "Only active staff" ON public.contratos_cron_token;
CREATE POLICY "Only active staff" ON public.contratos_cron_token AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
INSERT INTO public.contratos_cron_token (id, token)
VALUES (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule('contratos-rotina-diaria');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

-- Todo dia às 11:20 UTC (08:20 em São Paulo).
SELECT cron.schedule(
  'contratos-rotina-diaria',
  '20 11 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gestao.onlinerastreamento.com.br/api/public/hooks/contratos-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-contratos-cron-token', (SELECT token FROM public.contratos_cron_token WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
