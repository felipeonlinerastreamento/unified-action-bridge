-- lovable-cron-fallback-reviewed: régua de cobrança diária (09:05 em São Paulo) pedida pelo usuário; só envia se ligada na tela
-- =====================================================================
-- Financeiro › Inadimplência: situação do cliente (GSystem), contatos de cobrança,
-- histórico de cobrança (contato, promessa, acordo, perda), régua de cobrança automática
-- e marcação de perda provável. Acesso: só quem está no Financeiro (can_access_finance).
-- =====================================================================

-- 1) Clientes do Financeiro: situação vinda do GSystem + contatos de cobrança editáveis.
CREATE TABLE IF NOT EXISTS public.fin_clientes (
  documento text PRIMARY KEY,                 -- CPF/CNPJ só números
  nome text,
  gsystem_key text,
  situacao_gsystem text,                      -- texto como veio do GSystem (Ativo, Inativo, Cancelado...)
  ativo_gsystem boolean,                      -- leitura normalizada; null = GSystem não informou
  telefone text,                              -- do GSystem
  email text,                                 -- do GSystem
  telefone_cobranca text,                     -- editável: tem prioridade na régua
  email_cobranca text,
  regua_pausada boolean NOT NULL DEFAULT false,
  observacao text,
  atualizado_gsystem_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Histórico de cobrança por cliente.
CREATE TABLE IF NOT EXISTS public.fin_cobranca_acoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento text NOT NULL,
  cliente_nome text,
  tipo text NOT NULL CHECK (tipo IN ('contato','promessa','acordo','nota','perda','perda_desfeita','bloqueio','desbloqueio','regua')),
  canal text,                                 -- whatsapp, email, telefone, presencial
  resultado text,                             -- sem_resposta, vai_pagar, contestou, sem_condicoes, pagou...
  data_promessa date,
  valor numeric(14,2),
  parcelas int,
  primeiro_vencimento date,
  observacao text,
  lancamento_ids uuid[] NOT NULL DEFAULT '{}',
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_cobranca_acoes_doc_idx ON public.fin_cobranca_acoes (documento, created_at DESC);

-- 3) Régua de cobrança (linha única).
CREATE TABLE IF NOT EXISTS public.fin_cobranca_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativo boolean NOT NULL DEFAULT false,
  passos jsonb NOT NULL DEFAULT '[{"dias":-3,"whatsapp":true,"email":true},{"dias":3,"whatsapp":true,"email":true},{"dias":10,"whatsapp":true,"email":true},{"dias":30,"whatsapp":true,"email":true}]'::jsonb,
  mensagem_antes text,
  mensagem_atraso text,
  whatsapp_channel_id uuid,
  email_channel_id uuid,
  valor_minimo numeric(14,2) NOT NULL DEFAULT 0,
  so_ativos boolean NOT NULL DEFAULT false,
  dias_bloqueio int NOT NULL DEFAULT 30,
  dias_perda int NOT NULL DEFAULT 180,
  ultima_execucao_em timestamptz,
  ultima_execucao jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fin_cobranca_config (id) VALUES (1) ON CONFLICT DO NOTHING;

-- 4) Envios da régua (um por fatura, passo e canal: nunca repete).
CREATE TABLE IF NOT EXISTS public.fin_cobranca_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  lancamento_id uuid NOT NULL REFERENCES public.fin_lancamentos(id) ON DELETE CASCADE,
  documento text,
  passo text NOT NULL,                        -- ex.: "-3", "3", "10"
  canal text NOT NULL CHECK (canal IN ('whatsapp','email')),
  destino text,
  status text NOT NULL CHECK (status IN ('enviado','erro','sem_contato')),
  erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (lancamento_id, passo, canal)
);
CREATE INDEX IF NOT EXISTS fin_cobranca_envios_doc_idx ON public.fin_cobranca_envios (documento, created_at DESC);

-- 5) Perda provável e promessa na própria fatura.
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS perda_provavel boolean NOT NULL DEFAULT false;
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS perda_marcada_em timestamptz;
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS promessa_pagamento date;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin_clientes','fin_cobranca_acoes','fin_cobranca_config','fin_cobranca_envios']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance())', t || '_all', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
  END LOOP;
END $$;
-- Envios só o servidor grava.
REVOKE INSERT, UPDATE, DELETE ON public.fin_cobranca_envios FROM authenticated;

-- 6) Pós-venda: dias do atraso mais antigo (o valor e a quantidade já existem na carteira).
ALTER TABLE public.crm_posvenda_carteira ADD COLUMN IF NOT EXISTS vencidas_dias int;

-- 7) Régua diária às 09:05 de São Paulo (12:05 UTC). Só envia se ativo = true na configuração.
DO $$
BEGIN
  PERFORM cron.unschedule('financeiro-cobranca');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
SELECT cron.schedule(
  'financeiro-cobranca',
  '5 12 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gestao.onlinerastreamento.com.br/api/public/hooks/financeiro-cobranca',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fin-cron-token', (SELECT token FROM public.fin_cron_token WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
