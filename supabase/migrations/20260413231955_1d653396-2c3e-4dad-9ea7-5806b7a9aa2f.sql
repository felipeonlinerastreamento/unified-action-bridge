
-- Create ticket status enum
CREATE TYPE public.service_ticket_status AS ENUM ('aberto', 'em_andamento', 'finalizado');

-- Companies table
CREATE TABLE public.companies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  cnpj text,
  phone text,
  emails text[] DEFAULT '{}',
  contacts jsonb DEFAULT '[]',
  instructions text DEFAULT '',
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view companies" ON public.companies
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage companies" ON public.companies
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Company phones lookup table
CREATE TABLE public.company_phones (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  phone_number text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.company_phones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view company phones" ON public.company_phones
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins gestors manage company phones" ON public.company_phones
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- Service tickets table
CREATE TABLE public.service_tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  attendance_id text NOT NULL,
  channel_id uuid REFERENCES public.channels(id),
  company_id uuid REFERENCES public.companies(id),
  contact_phone text,
  contact_name text,
  plate text,
  status public.service_ticket_status NOT NULL DEFAULT 'aberto',
  opened_by uuid,
  notes text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz
);

ALTER TABLE public.service_tickets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view tickets" ON public.service_tickets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users create tickets" ON public.service_tickets
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users update tickets" ON public.service_tickets
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_service_tickets_updated_at
  BEFORE UPDATE ON public.service_tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast phone lookup
CREATE INDEX idx_company_phones_number ON public.company_phones(phone_number);

-- Index for attendance_id lookup
CREATE INDEX idx_service_tickets_attendance ON public.service_tickets(attendance_id);

-- Index for plate lookup
CREATE INDEX idx_service_tickets_plate ON public.service_tickets(plate) WHERE plate IS NOT NULL;
