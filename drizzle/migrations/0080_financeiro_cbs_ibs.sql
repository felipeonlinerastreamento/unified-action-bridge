-- Reforma tributária (Lucro Real): CBS/IBS destacados nas notas de fornecedores viram crédito.
-- Guarda os valores lidos do XML em cada conta a pagar e registra evidência quando a conta não bate.

ALTER TABLE public.fin_lancamentos
  ADD COLUMN IF NOT EXISTS rtc_base numeric,
  ADD COLUMN IF NOT EXISTS cbs_valor numeric,
  ADD COLUMN IF NOT EXISTS ibs_valor numeric,
  ADD COLUMN IF NOT EXISTS rtc_dados jsonb;

DO $$
DECLARE c text;
BEGIN
  SELECT conname INTO c FROM pg_constraint
   WHERE conrelid = 'public.fin_evidencias'::regclass AND contype = 'c' AND pg_get_constraintdef(oid) ILIKE '%valor_divergente%';
  IF c IS NOT NULL THEN EXECUTE format('ALTER TABLE public.fin_evidencias DROP CONSTRAINT %I', c); END IF;
END $$;
ALTER TABLE public.fin_evidencias ADD CONSTRAINT fin_evidencias_tipo_check
  CHECK (tipo IN ('regra_alterada','valor_divergente','aumento_valor','boleto_fora_dda','dda_sem_cobranca','aprovacao','pagamento','tributo_divergente'));
