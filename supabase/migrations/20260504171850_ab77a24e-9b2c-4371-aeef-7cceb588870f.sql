ALTER TABLE public.crm_contacts
  ADD COLUMN IF NOT EXISTS contract_items jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS activation_total numeric(12,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS monthly_total numeric(12,2) NOT NULL DEFAULT 0;