ALTER TABLE public.zapi_chats ADD COLUMN IF NOT EXISTS lid text;
CREATE INDEX IF NOT EXISTS idx_zapi_chats_channel_lid ON public.zapi_chats (channel_id, lid) WHERE lid IS NOT NULL;