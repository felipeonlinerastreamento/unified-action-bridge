
CREATE TABLE public.inactivity_message_settings (
  id text PRIMARY KEY DEFAULT 'default' CHECK (id = 'default'),
  is_enabled boolean NOT NULL DEFAULT false,
  message text NOT NULL DEFAULT 'Estou finalizando outro atendimento e já te atualizo por aqui, tudo bem?',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.inactivity_message_settings TO authenticated;
GRANT ALL ON public.inactivity_message_settings TO service_role;
ALTER TABLE public.inactivity_message_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read inactivity settings" ON public.inactivity_message_settings
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Managers insert inactivity settings" ON public.inactivity_message_settings
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Managers update inactivity settings" ON public.inactivity_message_settings
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE TRIGGER trg_inactivity_message_settings_updated BEFORE UPDATE ON public.inactivity_message_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
INSERT INTO public.inactivity_message_settings (id) VALUES ('default') ON CONFLICT DO NOTHING;

ALTER TABLE public.zapi_chats ADD COLUMN IF NOT EXISTS inactivity_message_sent_at timestamptz;
-- conversas já existentes não recebem a mensagem retroativamente
UPDATE public.zapi_chats SET inactivity_message_sent_at = now() WHERE inactivity_message_sent_at IS NULL;
