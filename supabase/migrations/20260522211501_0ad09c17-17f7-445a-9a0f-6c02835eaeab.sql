ALTER TABLE public.zapi_chats ADD COLUMN IF NOT EXISTS lid_aliases text[] DEFAULT '{}'::text[];
CREATE INDEX IF NOT EXISTS idx_zapi_chats_lid_aliases ON public.zapi_chats USING GIN (lid_aliases);