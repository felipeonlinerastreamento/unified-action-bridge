
CREATE TABLE public.chat_technicians (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_phone text NOT NULL,
  name text NOT NULL,
  phone text,
  address text,
  notes text,
  created_by uuid,
  created_by_name text,
  updated_by uuid,
  updated_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_technicians_contact_phone ON public.chat_technicians(contact_phone);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_technicians TO authenticated;
GRANT ALL ON public.chat_technicians TO service_role;

ALTER TABLE public.chat_technicians ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view technicians"
  ON public.chat_technicians FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert technicians"
  ON public.chat_technicians FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated can update technicians"
  ON public.chat_technicians FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Authenticated can delete technicians"
  ON public.chat_technicians FOR DELETE TO authenticated USING (true);

CREATE TRIGGER update_chat_technicians_updated_at
  BEFORE UPDATE ON public.chat_technicians
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
