UPDATE public.zapi_chats
SET status = 'finalizado',
    assigned_to = NULL,
    closed_at = COALESCE(closed_at, now())
WHERE id = '49756321-7941-4bb0-8d94-c2125e1cb7cc'
  AND status <> 'finalizado';