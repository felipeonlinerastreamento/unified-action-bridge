
ALTER TABLE public.crm_opportunities
  ADD COLUMN IF NOT EXISTS contact_name text,
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS contact_phone text,
  ADD COLUMN IF NOT EXISTS contact_email text,
  ADD COLUMN IF NOT EXISTS cnpj text,
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.crm_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contract_items jsonb NOT NULL DEFAULT '[]'::jsonb;
