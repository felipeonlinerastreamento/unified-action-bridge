ALTER TABLE public.crm_contacts DROP CONSTRAINT IF EXISTS crm_contacts_contact_type_check;
ALTER TABLE public.crm_contacts ADD CONSTRAINT crm_contacts_contact_type_check CHECK (contact_type = ANY (ARRAY['PF'::text, 'PJ'::text, 'FORN'::text]));
ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS supplier_category text;