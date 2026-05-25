
-- Operator chat: persistent, realtime, optional locking modal
CREATE TABLE public.operator_chats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid,
  created_by uuid NOT NULL,
  created_by_name text,
  recipient_user_id uuid NOT NULL,
  subject text NOT NULL,
  lock_until_reply boolean NOT NULL DEFAULT false,
  is_locked boolean NOT NULL DEFAULT false,
  last_message_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_chats_recipient ON public.operator_chats(recipient_user_id) WHERE closed_at IS NULL;
CREATE INDEX idx_operator_chats_creator ON public.operator_chats(created_by) WHERE closed_at IS NULL;

CREATE TABLE public.operator_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.operator_chats(id) ON DELETE CASCADE,
  sender_user_id uuid NOT NULL,
  sender_name text,
  body text NOT NULL,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_operator_chat_messages_chat ON public.operator_chat_messages(chat_id, created_at);

ALTER TABLE public.operator_chats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.operator_chat_messages ENABLE ROW LEVEL SECURITY;

-- helper to avoid recursive RLS
CREATE OR REPLACE FUNCTION public.is_operator_chat_participant(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operator_chats
    WHERE id = _chat_id
      AND (created_by = _user_id OR recipient_user_id = _user_id)
  );
$$;

-- Policies: operator_chats
CREATE POLICY "Participants and admins can view chats"
ON public.operator_chats FOR SELECT
USING (
  created_by = auth.uid()
  OR recipient_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Admins and gestores can create chats"
ON public.operator_chats FOR INSERT
WITH CHECK (
  created_by = auth.uid()
  AND (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'gestor'))
);

CREATE POLICY "Participants can update chats"
ON public.operator_chats FOR UPDATE
USING (
  created_by = auth.uid()
  OR recipient_user_id = auth.uid()
  OR has_role(auth.uid(), 'admin')
);

-- Policies: operator_chat_messages
CREATE POLICY "Participants can view messages"
ON public.operator_chat_messages FOR SELECT
USING (
  public.is_operator_chat_participant(auth.uid(), chat_id)
  OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Participants can insert messages"
ON public.operator_chat_messages FOR INSERT
WITH CHECK (
  sender_user_id = auth.uid()
  AND public.is_operator_chat_participant(auth.uid(), chat_id)
);

CREATE POLICY "Participants can update own messages (read receipt)"
ON public.operator_chat_messages FOR UPDATE
USING (
  public.is_operator_chat_participant(auth.uid(), chat_id)
);

-- Trigger: unlock chat once recipient replies & bump last_message_at
CREATE OR REPLACE FUNCTION public.operator_chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_recipient uuid;
  v_is_locked boolean;
BEGIN
  SELECT recipient_user_id, is_locked INTO v_recipient, v_is_locked
  FROM public.operator_chats WHERE id = NEW.chat_id;

  UPDATE public.operator_chats
  SET last_message_at = NEW.created_at,
      updated_at = now(),
      is_locked = CASE
        WHEN v_is_locked AND NEW.sender_user_id = v_recipient THEN false
        ELSE is_locked
      END
  WHERE id = NEW.chat_id;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_operator_chat_messages_after_insert
AFTER INSERT ON public.operator_chat_messages
FOR EACH ROW EXECUTE FUNCTION public.operator_chat_messages_after_insert();

CREATE TRIGGER trg_operator_chats_updated
BEFORE UPDATE ON public.operator_chats
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_chats;
ALTER PUBLICATION supabase_realtime ADD TABLE public.operator_chat_messages;
ALTER TABLE public.operator_chats REPLICA IDENTITY FULL;
ALTER TABLE public.operator_chat_messages REPLICA IDENTITY FULL;
