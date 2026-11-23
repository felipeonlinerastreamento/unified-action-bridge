-- O id da parcela no Bom Controle é um GUID (texto), não número. Troca o tipo da coluna;
-- o índice único parcial continua valendo.
DROP INDEX IF EXISTS public.fin_lancamentos_bomcontrole_parcela_uq;
ALTER TABLE public.fin_lancamentos ALTER COLUMN bomcontrole_parcela_id TYPE text USING bomcontrole_parcela_id::text;
CREATE UNIQUE INDEX IF NOT EXISTS fin_lancamentos_bomcontrole_parcela_uq
  ON public.fin_lancamentos (bomcontrole_parcela_id) WHERE bomcontrole_parcela_id IS NOT NULL;
