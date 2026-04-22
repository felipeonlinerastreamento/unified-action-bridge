
-- 1. Extend channels with Z-API fields
ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS zapi_instance_id text,
  ADD COLUMN IF NOT EXISTS zapi_client_token text,
  ADD COLUMN IF NOT EXISTS webhook_secret text DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS bot_mode text DEFAULT 'always';

-- Force migration: deactivate existing channels until reconfigured for Z-API
UPDATE public.channels SET platform = 'zapi', is_active = false WHERE platform != 'zapi';

-- 2. zapi_chats
CREATE TABLE IF NOT EXISTS public.zapi_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid NOT NULL REFERENCES public.channels(id) ON DELETE CASCADE,
  phone text NOT NULL,
  contact_name text,
  contact_avatar text,
  status text NOT NULL DEFAULT 'aguardando',
  sector_name text,
  assigned_to uuid,
  unread_count int NOT NULL DEFAULT 0,
  last_message_at timestamptz,
  last_message_preview text,
  tags jsonb NOT NULL DEFAULT '[]'::jsonb,
  bot_state jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(channel_id, phone)
);

CREATE INDEX IF NOT EXISTS idx_zapi_chats_channel ON public.zapi_chats(channel_id);
CREATE INDEX IF NOT EXISTS idx_zapi_chats_status ON public.zapi_chats(status);
CREATE INDEX IF NOT EXISTS idx_zapi_chats_assigned ON public.zapi_chats(assigned_to);

ALTER TABLE public.zapi_chats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view zapi chats" ON public.zapi_chats
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users update zapi chats" ON public.zapi_chats
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users insert zapi chats" ON public.zapi_chats
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Admins delete zapi chats" ON public.zapi_chats
  FOR DELETE TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER trg_zapi_chats_updated
  BEFORE UPDATE ON public.zapi_chats
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. zapi_messages
CREATE TABLE IF NOT EXISTS public.zapi_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.zapi_chats(id) ON DELETE CASCADE,
  zapi_message_id text,
  from_me boolean NOT NULL,
  is_whisper boolean NOT NULL DEFAULT false,
  whisper_author uuid,
  text text,
  media_url text,
  media_type text,
  status text NOT NULL DEFAULT 'sent',
  is_typing boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_zapi_messages_chat ON public.zapi_messages(chat_id, created_at DESC);

ALTER TABLE public.zapi_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view zapi messages" ON public.zapi_messages
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users insert zapi messages" ON public.zapi_messages
  FOR INSERT TO authenticated WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Auth users update zapi messages" ON public.zapi_messages
  FOR UPDATE TO authenticated USING (auth.uid() IS NOT NULL);

-- 4. zapi_bot_flows
CREATE TABLE IF NOT EXISTS public.zapi_bot_flows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id uuid REFERENCES public.channels(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  nodes jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zapi_bot_flows ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view bot flows" ON public.zapi_bot_flows
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins gestors manage bot flows" ON public.zapi_bot_flows
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_zapi_bot_flows_updated
  BEFORE UPDATE ON public.zapi_bot_flows
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. zapi_quick_replies
CREATE TABLE IF NOT EXISTS public.zapi_quick_replies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shortcut text NOT NULL,
  label text NOT NULL,
  content text NOT NULL,
  created_by uuid,
  is_global boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.zapi_quick_replies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view quick replies" ON public.zapi_quick_replies
  FOR SELECT TO authenticated USING (auth.uid() IS NOT NULL);
CREATE POLICY "Users manage own quick replies" ON public.zapi_quick_replies
  FOR ALL TO authenticated
  USING (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (auth.uid() = created_by OR has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE TRIGGER trg_zapi_quick_replies_updated
  BEFORE UPDATE ON public.zapi_quick_replies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. pick_least_loaded_agent function
CREATE OR REPLACE FUNCTION public.pick_least_loaded_agent(_sector text)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT usa.user_id
  FROM public.user_sector_assignments usa
  JOIN public.sectors s ON s.id = usa.sector_id
  WHERE lower(s.name) = lower(_sector) AND s.is_active = true
  ORDER BY (
    SELECT COUNT(*) FROM public.zapi_chats zc
    WHERE zc.assigned_to = usa.user_id AND zc.status = 'em_atendimento'
  ) ASC
  LIMIT 1;
$$;

-- 7. Realtime
ALTER TABLE public.zapi_chats REPLICA IDENTITY FULL;
ALTER TABLE public.zapi_messages REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zapi_chats'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zapi_chats;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables 
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'zapi_messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.zapi_messages;
  END IF;
END $$;

-- 8. Seed default bot flow
INSERT INTO public.zapi_bot_flows (name, is_active, nodes) VALUES (
  'Menu de Boas-vindas Padrão',
  true,
  '[
    {
      "id": "welcome",
      "type": "menu",
      "text": "👋 Olá {{contactName}}, bom dia.\n\nÉ um prazer atendê-lo(a) e para seguirmos com o seu atendimento, por favor, selecione uma das opções abaixo:\n\n[ 1 ] - 😉 Falar com um Atendente\n[ 2 ] - 💼 Falar com o Comercial\n[ 3 ] - 💰 2ª via de Fatura\n[ 4 ] - ❌ Finalizar Atendimento",
      "options": [
        {"key": "1", "label": "Atendente", "next": "ask_info"},
        {"key": "2", "label": "Comercial", "next": "route_comercial"},
        {"key": "3", "label": "2ª via", "next": "route_financeiro"},
        {"key": "4", "label": "Finalizar", "next": "end_node"}
      ]
    },
    {
      "id": "ask_info",
      "type": "message",
      "text": "Por favor, informe seu nome e a placa do veículo que você quer tratar.\n\nAh! E se você ainda não é nosso cliente, apenas informe o seu nome.",
      "next": "route_atendimento"
    },
    {
      "id": "route_atendimento",
      "type": "route_to_least_loaded",
      "target_sector": "Atendimento"
    },
    {
      "id": "route_comercial",
      "type": "route_to_sector",
      "target_sector": "Comercial"
    },
    {
      "id": "route_financeiro",
      "type": "route_to_sector",
      "target_sector": "Financeiro"
    },
    {
      "id": "end_node",
      "type": "end",
      "text": "Atendimento finalizado, obrigado! 👋"
    }
  ]'::jsonb
)
ON CONFLICT DO NOTHING;
