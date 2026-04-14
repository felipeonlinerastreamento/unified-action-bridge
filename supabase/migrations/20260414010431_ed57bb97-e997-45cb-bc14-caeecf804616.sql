
-- CRM Contacts table
CREATE TABLE public.crm_contacts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT DEFAULT '',
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_contacts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view crm contacts"
  ON public.crm_contacts FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage crm contacts"
  ON public.crm_contacts FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role) OR has_role(auth.uid(), 'atendente'::app_role));

CREATE TRIGGER update_crm_contacts_updated_at
  BEFORE UPDATE ON public.crm_contacts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Sub-clients table (linked to a parent company)
CREATE TABLE public.sub_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  notes TEXT DEFAULT '',
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.sub_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view sub clients"
  ON public.sub_clients FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users manage sub clients"
  ON public.sub_clients FOR ALL
  USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_sub_clients_updated_at
  BEFORE UPDATE ON public.sub_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
