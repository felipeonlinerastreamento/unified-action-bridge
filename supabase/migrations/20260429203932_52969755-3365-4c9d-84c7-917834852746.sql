ALTER TABLE public.crm_contacts
ADD COLUMN IF NOT EXISTS contact_type text NOT NULL DEFAULT 'PF';

ALTER TABLE public.crm_contacts
DROP CONSTRAINT IF EXISTS crm_contacts_contact_type_check;

ALTER TABLE public.crm_contacts
ADD CONSTRAINT crm_contacts_contact_type_check CHECK (contact_type IN ('PF','PJ'));