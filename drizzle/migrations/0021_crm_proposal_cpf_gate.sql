ALTER TABLE public.crm_proposal_links
  ADD COLUMN IF NOT EXISTS viewer_cpf text,
  ADD COLUMN IF NOT EXISTS cpf_verified_at timestamptz,
  ADD COLUMN IF NOT EXISTS responder_cpf text;