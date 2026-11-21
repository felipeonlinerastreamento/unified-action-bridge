-- =====================================================================
-- Financeiro: importação das faturas do GSystem como contas a receber.
-- Cada fatura vira um lançamento tipo 'receber', origem 'gsystem', sem duplicar
-- (chave única gsystem_fatura_key). O andamento da importação fica em fin_gsystem_sync.
-- =====================================================================

ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS gsystem_fatura_key text;
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS gsystem_cliente_key text;
CREATE UNIQUE INDEX IF NOT EXISTS fin_lancamentos_gsystem_fatura_key_uq
  ON public.fin_lancamentos (gsystem_fatura_key) WHERE gsystem_fatura_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_lancamentos_doc_idx ON public.fin_lancamentos (documento_contraparte);

ALTER TABLE public.fin_lancamentos DROP CONSTRAINT IF EXISTS fin_lancamentos_origem_check;
ALTER TABLE public.fin_lancamentos ADD CONSTRAINT fin_lancamentos_origem_check
  CHECK (origem IN ('drive', 'upload', 'manual', 'importacao', 'gsystem'));

-- Andamento da importação (uma linha: id = 'faturas').
-- A importação roda em lotes; "proximo_indice" diz de qual cliente continuar.
CREATE TABLE IF NOT EXISTS public.fin_gsystem_sync (
  id text PRIMARY KEY,
  proximo_indice int NOT NULL DEFAULT 0,
  total_clientes int,
  rodada_iniciada_em timestamptz,
  ultima_execucao_em timestamptz,
  ultima_rodada_concluida_em timestamptz,
  faturas_novas int NOT NULL DEFAULT 0,
  faturas_atualizadas int NOT NULL DEFAULT 0,
  erros int NOT NULL DEFAULT 0,
  ultimo_erro text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_gsystem_sync ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fin_gsystem_sync_select" ON public.fin_gsystem_sync;
CREATE POLICY "fin_gsystem_sync_select" ON public.fin_gsystem_sync
  FOR SELECT TO authenticated USING (public.can_access_finance());
DROP POLICY IF EXISTS "Only active staff" ON public.fin_gsystem_sync;
CREATE POLICY "Only active staff" ON public.fin_gsystem_sync AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT SELECT ON public.fin_gsystem_sync TO authenticated;
GRANT ALL ON public.fin_gsystem_sync TO service_role;
