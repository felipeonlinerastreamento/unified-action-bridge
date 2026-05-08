-- 1) Adiciona coluna para preservar quem finalizou o chat e quando
ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS closed_by_user_id uuid,
  ADD COLUMN IF NOT EXISTS closed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_zapi_chats_closed_by ON public.zapi_chats(closed_by_user_id);
CREATE INDEX IF NOT EXISTS idx_zapi_chats_closed_at ON public.zapi_chats(closed_at);

-- 2) Trigger: captura assigned_to no momento em que o chat passa para 'finalizado'
CREATE OR REPLACE FUNCTION public.zapi_chats_capture_closer()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.status = 'finalizado'
     AND (OLD.status IS DISTINCT FROM 'finalizado') THEN
    -- Preserva o operador atribuído antes de qualquer limpeza posterior
    IF NEW.closed_by_user_id IS NULL THEN
      NEW.closed_by_user_id := COALESCE(OLD.assigned_to, NEW.assigned_to);
    END IF;
    IF NEW.closed_at IS NULL THEN
      NEW.closed_at := now();
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_zapi_chats_capture_closer ON public.zapi_chats;
CREATE TRIGGER trg_zapi_chats_capture_closer
BEFORE UPDATE ON public.zapi_chats
FOR EACH ROW
EXECUTE FUNCTION public.zapi_chats_capture_closer();

-- 3) Backfill: para chats já finalizados sem closed_by_user_id,
--    usa o último operador que enviou mensagem nesse chat.
UPDATE public.zapi_chats c
SET closed_by_user_id = sub.sent_by_user_id,
    closed_at = COALESCE(c.closed_at, c.updated_at)
FROM (
  SELECT DISTINCT ON (m.chat_id)
    m.chat_id, m.sent_by_user_id
  FROM public.zapi_messages m
  WHERE m.from_me = true
    AND m.sent_by_user_id IS NOT NULL
    AND COALESCE(m.is_whisper, false) = false
  ORDER BY m.chat_id, m.created_at DESC
) sub
WHERE c.id = sub.chat_id
  AND c.status = 'finalizado'
  AND c.closed_by_user_id IS NULL;