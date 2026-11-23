-- =====================================================================
-- Financeiro › Inadimplência › Protesto e Serasa: registro de cada negativação (Serasa, SPC,
-- Boa Vista) e protesto em cartório, com as faturas incluídas, protocolo, custos, baixa e
-- carta de anuência. A baixa tem prazo (Súmula 548 do STJ: 5 dias úteis após o pagamento).
-- Acesso: só quem está no Financeiro (can_access_finance).
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.fin_negativacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  documento text NOT NULL,                       -- CPF/CNPJ só números
  cliente_nome text,
  orgao text NOT NULL CHECK (orgao IN ('serasa','spc','boa_vista','protesto')),
  situacao text NOT NULL DEFAULT 'preparando' CHECK (situacao IN ('preparando','enviado','ativo','baixado','cancelado')),
  valor numeric(14,2) NOT NULL DEFAULT 0,
  lancamento_ids uuid[] NOT NULL DEFAULT '{}',
  data_envio date,                               -- enviado ao órgão / apresentado ao cartório
  data_inclusao date,                            -- negativado / protestado de fato
  protocolo text,
  cartorio text,
  cidade_uf text,
  custo numeric(14,2),                           -- tarifa do órgão ou emolumentos
  data_quitacao date,                            -- informada à mão (o sistema também deduz pelas faturas)
  data_baixa date,
  anuencia_emitida_em timestamptz,
  motivo_cancelamento text,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_negativacoes_doc_idx ON public.fin_negativacoes (documento);
CREATE INDEX IF NOT EXISTS fin_negativacoes_sit_idx ON public.fin_negativacoes (situacao);

ALTER TABLE public.fin_negativacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_negativacoes_all ON public.fin_negativacoes;
CREATE POLICY fin_negativacoes_all ON public.fin_negativacoes FOR ALL TO authenticated
  USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
DROP POLICY IF EXISTS "Only active staff" ON public.fin_negativacoes;
CREATE POLICY "Only active staff" ON public.fin_negativacoes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fin_negativacoes TO authenticated;
GRANT ALL ON public.fin_negativacoes TO service_role;

-- Histórico do cliente ganha os passos da negativação/protesto.
ALTER TABLE public.fin_cobranca_acoes DROP CONSTRAINT IF EXISTS fin_cobranca_acoes_tipo_check;
ALTER TABLE public.fin_cobranca_acoes ADD CONSTRAINT fin_cobranca_acoes_tipo_check
  CHECK (tipo IN ('contato','promessa','acordo','nota','perda','perda_desfeita','bloqueio','desbloqueio','regua','negativacao','protesto','baixa','anuencia'));

-- Critérios das sugestões e prazo de baixa.
ALTER TABLE public.fin_cobranca_config ADD COLUMN IF NOT EXISTS neg_dias_minimo int NOT NULL DEFAULT 60;
ALTER TABLE public.fin_cobranca_config ADD COLUMN IF NOT EXISTS neg_valor_minimo numeric(14,2) NOT NULL DEFAULT 100;
ALTER TABLE public.fin_cobranca_config ADD COLUMN IF NOT EXISTS prazo_baixa_dias_uteis int NOT NULL DEFAULT 5;
