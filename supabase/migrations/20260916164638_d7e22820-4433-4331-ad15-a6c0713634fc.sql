ALTER TABLE public.zapi_messages ADD COLUMN IF NOT EXISTS is_bot_message boolean NOT NULL DEFAULT false;

GRANT SELECT, INSERT, UPDATE ON public.zapi_messages TO authenticated;
GRANT ALL ON public.zapi_messages TO service_role;

COMMENT ON COLUMN public.zapi_messages.is_bot_message IS 'Indica se a mensagem foi enviada pelo robô de atendimento automático';