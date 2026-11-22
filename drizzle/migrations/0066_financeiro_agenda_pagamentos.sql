-- Financeiro › Agenda de pagamentos: data programada para pagar (pode ser antes do vencimento)
-- e quem programou. A agenda usa a data programada e, sem ela, o vencimento.
ALTER TABLE public.fin_lancamentos
  ADD COLUMN IF NOT EXISTS data_programada date,
  ADD COLUMN IF NOT EXISTS programado_por uuid,
  ADD COLUMN IF NOT EXISTS programado_em timestamptz;
CREATE INDEX IF NOT EXISTS fin_lancamentos_programada_idx ON public.fin_lancamentos (data_programada) WHERE data_programada IS NOT NULL;
