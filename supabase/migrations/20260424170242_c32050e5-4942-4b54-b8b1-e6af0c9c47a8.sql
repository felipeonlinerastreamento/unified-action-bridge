DELETE FROM public.zapi_messages
WHERE from_me = false
  AND (text IS NULL OR text = '')
  AND media_url IS NULL;