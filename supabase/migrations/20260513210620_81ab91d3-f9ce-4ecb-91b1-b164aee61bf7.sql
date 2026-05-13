UPDATE public.zapi_messages
SET media_type = NULL
WHERE media_type IN ('call','call_missed')
  AND (from_me = true OR text NOT LIKE '📞%')
  AND created_at > now() - interval '12 hours';