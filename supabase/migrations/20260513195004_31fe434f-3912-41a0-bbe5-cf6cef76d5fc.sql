DO $$
DECLARE
  grp record;
  keep_id uuid;
  drop_ids uuid[];
  total_unread int;
  latest_at timestamptz;
BEGIN
  FOR grp IN
    WITH norm AS (
      SELECT id, channel_id, phone,
             public.normalize_zapi_phone(phone) AS canonical
      FROM public.zapi_chats
      WHERE phone IS NOT NULL AND phone <> ''
    )
    SELECT channel_id, canonical, array_agg(id) AS ids
    FROM norm
    WHERE canonical IS NOT NULL
    GROUP BY channel_id, canonical
    HAVING count(*) > 1
  LOOP
    SELECT zc.id INTO keep_id
    FROM public.zapi_chats zc
    LEFT JOIN (
      SELECT chat_id, count(*) c FROM public.zapi_messages
      WHERE chat_id = ANY(grp.ids) GROUP BY chat_id
    ) m ON m.chat_id = zc.id
    WHERE zc.id = ANY(grp.ids)
    ORDER BY COALESCE(m.c,0) DESC, zc.last_message_at DESC NULLS LAST
    LIMIT 1;

    drop_ids := array(SELECT unnest(grp.ids) EXCEPT SELECT keep_id);

    SELECT COALESCE(sum(unread_count),0), max(last_message_at)
      INTO total_unread, latest_at
    FROM public.zapi_chats WHERE id = ANY(grp.ids);

    DELETE FROM public.zapi_messages dm
    WHERE dm.chat_id = ANY(drop_ids)
      AND dm.zapi_message_id IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.zapi_messages km
        WHERE km.chat_id = keep_id
          AND km.zapi_message_id = dm.zapi_message_id
      );

    UPDATE public.zapi_messages              SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.attendance_event_logs      SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.chat_idle_auto_message_logs SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.chat_inactivity_alert_logs SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.csat_pending               SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.csat_responses             SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.message_trigger_logs       SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);
    UPDATE public.out_of_hours_message_log   SET chat_id = keep_id WHERE chat_id = ANY(drop_ids);

    DELETE FROM public.zapi_chats WHERE id = ANY(drop_ids);

    UPDATE public.zapi_chats
       SET phone = grp.canonical,
           unread_count = total_unread,
           last_message_at = COALESCE(latest_at, last_message_at)
     WHERE id = keep_id;
  END LOOP;
END $$;

UPDATE public.zapi_chats
   SET phone = public.normalize_zapi_phone(phone)
 WHERE phone IS NOT NULL AND phone <> ''
   AND public.normalize_zapi_phone(phone) IS NOT NULL
   AND phone IS DISTINCT FROM public.normalize_zapi_phone(phone);