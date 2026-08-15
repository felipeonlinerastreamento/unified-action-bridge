ALTER TABLE public.crm_contacts ALTER COLUMN contact_role SET DEFAULT 'lead';

UPDATE public.crm_contacts SET contact_role = 'fornecedor' WHERE contact_type = 'FORN';
UPDATE public.crm_contacts SET contact_role = 'cliente' WHERE contact_role IS NULL;

ALTER TABLE public.crm_contacts DROP CONSTRAINT crm_contacts_contact_role_check;
ALTER TABLE public.crm_contacts
  ADD CONSTRAINT crm_contacts_contact_role_check
  CHECK (contact_role IN ('lead','comercial','cliente','fornecedor','funcionario','parceiro','tecnico','outro'));