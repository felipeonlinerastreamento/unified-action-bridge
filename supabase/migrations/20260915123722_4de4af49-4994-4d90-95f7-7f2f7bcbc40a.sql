ALTER TABLE public.operator_chats ADD COLUMN IF NOT EXISTS is_group boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.operator_chat_participants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid NOT NULL REFERENCES public.operator_chats(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text,
  is_locked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (chat_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_op_chat_participants_user ON public.operator_chat_participants(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_chat_participants TO authenticated;
GRANT ALL ON public.operator_chat_participants TO service_role;

ALTER TABLE public.operator_chat_participants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_operator_chat_participant(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operator_chats
    WHERE id = _chat_id
      AND (created_by = _user_id OR recipient_user_id = _user_id)
  ) OR EXISTS (
    SELECT 1 FROM public.operator_chat_participants
    WHERE chat_id = _chat_id AND user_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_operator_chat_creator(_user_id uuid, _chat_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.operator_chats WHERE id = _chat_id AND created_by = _user_id
  );
$$;

DROP POLICY IF EXISTS "Participants can view chat participants" ON public.operator_chat_participants;
CREATE POLICY "Participants can view chat participants"
ON public.operator_chat_participants FOR SELECT TO authenticated
USING (public.is_operator_chat_participant(auth.uid(), chat_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Creator can add chat participants" ON public.operator_chat_participants;
CREATE POLICY "Creator can add chat participants"
ON public.operator_chat_participants FOR INSERT TO authenticated
WITH CHECK (public.is_operator_chat_creator(auth.uid(), chat_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Participants can update own participation" ON public.operator_chat_participants;
CREATE POLICY "Participants can update own participation"
ON public.operator_chat_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid() OR public.is_operator_chat_creator(auth.uid(), chat_id) OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Participants and admins can view chats" ON public.operator_chats;
CREATE POLICY "Participants and admins can view chats"
ON public.operator_chats FOR SELECT
USING (created_by = auth.uid() OR recipient_user_id = auth.uid()
       OR public.is_operator_chat_participant(auth.uid(), id)
       OR public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Participants can update chats" ON public.operator_chats;
CREATE POLICY "Participants can update chats"
ON public.operator_chats FOR UPDATE
USING (created_by = auth.uid() OR recipient_user_id = auth.uid()
       OR public.is_operator_chat_participant(auth.uid(), id)
       OR public.has_role(auth.uid(), 'admin'::app_role));

CREATE OR REPLACE FUNCTION public.operator_chat_messages_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

  UPDATE public.operator_chat_participants
  SET is_locked = false
  WHERE chat_id = NEW.chat_id AND user_id = NEW.sender_user_id AND is_locked;

  RETURN NEW;
END;
$$;