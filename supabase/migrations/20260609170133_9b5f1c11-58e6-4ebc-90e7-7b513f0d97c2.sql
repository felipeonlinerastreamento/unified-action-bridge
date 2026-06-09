
CREATE TABLE public.chat_controle_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL UNIQUE REFERENCES public.zapi_chats(id) ON DELETE CASCADE,
  url text NOT NULL,
  label text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_controle_links TO authenticated;
GRANT ALL ON public.chat_controle_links TO service_role;

ALTER TABLE public.chat_controle_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view chat controle links"
  ON public.chat_controle_links FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated can insert chat controle links"
  ON public.chat_controle_links FOR INSERT
  TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update chat controle links"
  ON public.chat_controle_links FOR UPDATE
  TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated can delete chat controle links"
  ON public.chat_controle_links FOR DELETE
  TO authenticated USING (true);

CREATE TRIGGER chat_controle_links_updated_at
  BEFORE UPDATE ON public.chat_controle_links
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
