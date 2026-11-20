SET LOCAL lock_timeout = '10s';

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- 1) Índices (os de zapi_messages já foram criados com CONCURRENTLY; aqui ficam registrados e viram no-op)
CREATE INDEX IF NOT EXISTS idx_zapi_messages_chat_created_cover
  ON public.zapi_messages USING btree (chat_id, created_at DESC) INCLUDE (from_me, is_whisper);
CREATE INDEX IF NOT EXISTS idx_zapi_messages_zapi_message_id
  ON public.zapi_messages USING btree (zapi_message_id) WHERE zapi_message_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_service_tickets_contact_phone_trgm
  ON public.service_tickets USING gin (contact_phone extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_ticket_comments_created_at
  ON public.ticket_comments USING btree (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_integration_logs_created_at
  ON public.integration_logs USING btree (created_at);

-- 2) Direção da última mensagem gravada na conversa
ALTER TABLE public.zapi_chats ADD COLUMN IF NOT EXISTS last_message_from_me boolean;
COMMENT ON COLUMN public.zapi_chats.last_message_from_me IS 'true quando a mensagem mais recente da conversa foi enviada pela empresa; mantido pelo trigger trg_zapi_messages_last_direction.';

CREATE OR REPLACE FUNCTION public.zapi_messages_track_last_direction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_from_me boolean := COALESCE(NEW.from_me, false);
BEGIN
  IF NEW.chat_id IS NULL OR COALESCE(NEW.is_typing, false) THEN
    RETURN NEW;
  END IF;
  -- Mensagens antigas importadas fora de ordem não sobrescrevem a direção atual.
  IF EXISTS (
    SELECT 1 FROM public.zapi_messages m
    WHERE m.chat_id = NEW.chat_id AND m.created_at > NEW.created_at
  ) THEN
    RETURN NEW;
  END IF;
  UPDATE public.zapi_chats
     SET last_message_from_me = v_from_me
   WHERE id = NEW.chat_id
     AND last_message_from_me IS DISTINCT FROM v_from_me;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.zapi_messages_track_last_direction() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_zapi_messages_last_direction ON public.zapi_messages;
CREATE TRIGGER trg_zapi_messages_last_direction
  AFTER INSERT ON public.zapi_messages
  FOR EACH ROW EXECUTE FUNCTION public.zapi_messages_track_last_direction();

-- Backfill único das conversas abertas
UPDATE public.zapi_chats c
   SET last_message_from_me = sub.from_me
  FROM (
    SELECT oc.id,
           (SELECT COALESCE(m.from_me, false)
              FROM public.zapi_messages m
             WHERE m.chat_id = oc.id
             ORDER BY m.created_at DESC
             LIMIT 1) AS from_me
      FROM public.zapi_chats oc
     WHERE oc.status NOT IN ('finalizado', 'aguardando_retorno')
  ) sub
 WHERE sub.id = c.id
   AND sub.from_me IS NOT NULL
   AND c.last_message_from_me IS DISTINCT FROM sub.from_me;

-- 3) Resumo dos contadores do menu (roda com as permissões do próprio usuário)
CREATE OR REPLACE FUNCTION public.sidebar_counters()
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  my_sectors AS (
    SELECT s.name
      FROM public.user_sector_assignments usa
      JOIN public.sectors s ON s.id = usa.sector_id
     WHERE usa.user_id = (SELECT uid FROM me)
       AND s.name IS NOT NULL
  ),
  my_op_chats AS (
    SELECT oc.id
      FROM public.operator_chats oc
     WHERE oc.closed_at IS NULL
       AND (
         oc.created_by = (SELECT uid FROM me)
         OR oc.recipient_user_id = (SELECT uid FROM me)
         OR oc.id IN (SELECT p.chat_id FROM public.operator_chat_participants p WHERE p.user_id = (SELECT uid FROM me))
       )
  )
  SELECT CASE WHEN (SELECT uid FROM me) IS NULL THEN
    jsonb_build_object('assigned_chats', 0, 'open_tickets', 0, 'unread_operator_msgs', 0, 'my_open_tickets', 0)
  ELSE jsonb_build_object(
    'assigned_chats', (
      SELECT count(*) FROM public.zapi_chats z
       WHERE z.assigned_to = (SELECT uid FROM me)
         AND z.status NOT IN ('finalizado', 'aguardando_retorno')
    ),
    'open_tickets', (
      SELECT count(*) FROM public.service_tickets t
       WHERE t.status <> 'finalizado'
         AND (NOT EXISTS (SELECT 1 FROM my_sectors) OR t.sector IN (SELECT name FROM my_sectors))
         AND (
           t.assigned_to = (SELECT uid FROM me)
           OR (
             t.assigned_to <> (SELECT uid FROM me)
             AND t.id IN (SELECT ta.ticket_id FROM public.ticket_agents ta WHERE ta.user_id = (SELECT uid FROM me))
           )
         )
    ),
    'unread_operator_msgs', (
      SELECT count(*) FROM public.operator_chat_messages m
       WHERE m.chat_id IN (SELECT id FROM my_op_chats)
         AND m.read_at IS NULL
         AND m.sender_user_id <> (SELECT uid FROM me)
    ),
    'my_open_tickets', (
      SELECT count(*) FROM public.service_tickets t2
       WHERE t2.assigned_to = (SELECT uid FROM me)
         AND t2.status IN ('aberto', 'em_andamento', 'reaberto')
    )
  ) END
$$;

REVOKE ALL ON FUNCTION public.sidebar_counters() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sidebar_counters() TO authenticated;