ALTER TABLE public.zapi_messages
  ADD COLUMN IF NOT EXISTS participant_name TEXT,
  ADD COLUMN IF NOT EXISTS participant_phone TEXT;