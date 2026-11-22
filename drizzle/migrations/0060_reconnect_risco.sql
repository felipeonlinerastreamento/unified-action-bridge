-- =====================================================================
-- Reconnect × Pós-venda: placas sem comunicação entram no risco de cancelamento.
-- Os campos rc_* da carteira são preenchidos no servidor (service role) depois de
-- cada importação do Reconnect e ao reconstruir a carteira. Sem novas permissões:
-- quem vê a carteira (aba posvenda) passa a ver também esses números.
-- =====================================================================
ALTER TABLE public.crm_posvenda_carteira
  ADD COLUMN IF NOT EXISTS rc_placas_paradas int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rc_dias_max int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rc_notificadas int NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rc_atualizado_em timestamptz;

CREATE INDEX IF NOT EXISTS crm_posvenda_carteira_rc_idx
  ON public.crm_posvenda_carteira (rc_placas_paradas) WHERE rc_placas_paradas > 0;