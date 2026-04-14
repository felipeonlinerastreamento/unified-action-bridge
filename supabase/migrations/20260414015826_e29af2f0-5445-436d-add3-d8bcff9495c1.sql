
-- Create CRM categories table
CREATE TABLE public.crm_categories (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  description text DEFAULT '',
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view crm categories"
ON public.crm_categories FOR SELECT TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage crm categories"
ON public.crm_categories FOR ALL TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Seed default categories
INSERT INTO public.crm_categories (name) VALUES
  ('Fornecedor'),
  ('Novo Cliente PF'),
  ('Novo Cliente PJ'),
  ('Outra categoria');

-- Add category_id to crm_contacts
ALTER TABLE public.crm_contacts
ADD COLUMN category_id uuid REFERENCES public.crm_categories(id) ON DELETE SET NULL;

-- Trigger for updated_at
CREATE TRIGGER update_crm_categories_updated_at
BEFORE UPDATE ON public.crm_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
