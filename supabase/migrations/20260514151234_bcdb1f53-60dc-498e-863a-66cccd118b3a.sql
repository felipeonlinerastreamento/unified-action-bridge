ALTER TABLE public.zapi_chats
  ADD COLUMN IF NOT EXISTS pending_resolve_user_id uuid,
  ADD COLUMN IF NOT EXISTS pending_resolve_ticket_id uuid,
  ADD COLUMN IF NOT EXISTS pending_resolve_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_zapi_chats_pending_resolve_status
  ON public.zapi_chats (status)
  WHERE status = 'aguardando_retorno';