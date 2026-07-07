UPDATE public.zapi_chats
SET assigned_to = public.pick_least_loaded_agent_any('Comercial')
WHERE id = 'e66459ad-6f0f-448e-9d93-32e26be37bc2'
  AND assigned_to IS NULL;