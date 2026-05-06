
CREATE TABLE public.chat_idle_auto_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT true,
  target TEXT NOT NULL CHECK (target IN ('customer','operator')),
  idle_minutes INT NOT NULL DEFAULT 5 CHECK (idle_minutes >= 1),
  message_template TEXT NOT NULL,
  cooldown_minutes INT NOT NULL DEFAULT 30,
  max_sends_per_ticket INT NOT NULL DEFAULT 2,
  apply_to_groups BOOLEAN NOT NULL DEFAULT false,
  channel_id UUID NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.chat_idle_auto_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin/Gestor manage idle auto messages"
ON public.chat_idle_auto_messages FOR ALL
TO authenticated
USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE POLICY "Authenticated read idle auto messages"
ON public.chat_idle_auto_messages FOR SELECT
TO authenticated
USING (true);

CREATE TRIGGER trg_chat_idle_auto_messages_updated
BEFORE UPDATE ON public.chat_idle_auto_messages
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.chat_idle_auto_message_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.chat_idle_auto_messages(id) ON DELETE SET NULL,
  chat_id UUID NOT NULL,
  channel_id UUID NULL,
  phone TEXT,
  contact_name TEXT,
  target TEXT NOT NULL,
  idle_minutes_at_send INT,
  message_sent TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_chat_idle_logs_chat_sent ON public.chat_idle_auto_message_logs(chat_id, sent_at DESC);
CREATE INDEX idx_chat_idle_logs_rule_chat ON public.chat_idle_auto_message_logs(rule_id, chat_id, sent_at DESC);

ALTER TABLE public.chat_idle_auto_message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read idle logs"
ON public.chat_idle_auto_message_logs FOR SELECT
TO authenticated
USING (true);

INSERT INTO public.chat_idle_auto_messages (name, target, idle_minutes, message_template, cooldown_minutes, max_sends_per_ticket)
VALUES
  ('Lembrete cliente 5min', 'customer', 5,
   '{{contactName}} ainda está aí? Preciso de uma interação para que o chamado não seja finalizado por inatividade.',
   30, 2),
  ('Lembrete operador 5min', 'operator', 5,
   '{{contactName}}, ainda estou aqui analisando sua situação. Já volto com devolutiva.',
   30, 2);
