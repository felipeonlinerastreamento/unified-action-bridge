-- =====================================================================
-- Financeiro › Importação do Bom Controle (pela API, chave em Configurações › Integrações).
-- Cada parcela do Bom Controle vira um lançamento (origem 'bomcontrole') sem duplicar:
-- chave única bomcontrole_parcela_id. Recebíveis que já vieram do GSystem não são importados
-- (a regra fica no servidor). A chave da API fica em integracoes_segredos (só o servidor lê).
-- =====================================================================
ALTER TABLE public.fin_lancamentos ADD COLUMN IF NOT EXISTS bomcontrole_parcela_id bigint;
CREATE UNIQUE INDEX IF NOT EXISTS fin_lancamentos_bomcontrole_parcela_uq
  ON public.fin_lancamentos (bomcontrole_parcela_id) WHERE bomcontrole_parcela_id IS NOT NULL;

ALTER TABLE public.fin_lancamentos DROP CONSTRAINT IF EXISTS fin_lancamentos_origem_check;
ALTER TABLE public.fin_lancamentos ADD CONSTRAINT fin_lancamentos_origem_check
  CHECK (origem IN ('drive', 'upload', 'manual', 'importacao', 'gsystem', 'email', 'dda', 'bomcontrole'));

-- Registro de cada importação (quem, quando, período e números), para conferência.
CREATE TABLE IF NOT EXISTS public.fin_bomcontrole_importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  de date NOT NULL,
  ate date NOT NULL,
  novos int NOT NULL DEFAULT 0,
  atualizados int NOT NULL DEFAULT 0,
  ignorados_gsystem int NOT NULL DEFAULT 0,
  ignorados_outros int NOT NULL DEFAULT 0,
  total_pagar numeric(14,2) NOT NULL DEFAULT 0,
  total_receber numeric(14,2) NOT NULL DEFAULT 0,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_bomcontrole_importacoes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "fin_bomcontrole_importacoes_finance" ON public.fin_bomcontrole_importacoes;
CREATE POLICY "fin_bomcontrole_importacoes_finance" ON public.fin_bomcontrole_importacoes
  FOR ALL TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
DROP POLICY IF EXISTS "Only active staff" ON public.fin_bomcontrole_importacoes;
CREATE POLICY "Only active staff" ON public.fin_bomcontrole_importacoes AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT SELECT, INSERT ON public.fin_bomcontrole_importacoes TO authenticated;
GRANT ALL ON public.fin_bomcontrole_importacoes TO service_role;
