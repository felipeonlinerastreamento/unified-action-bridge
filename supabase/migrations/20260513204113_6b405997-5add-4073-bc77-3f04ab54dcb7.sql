ALTER TABLE public.channels
  ADD COLUMN IF NOT EXISTS call_reject_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS call_reject_message text DEFAULT '*Essa é mensagem automática*

Esse número, por ser chat, não aceita ligações de WhatsApp, somente ligação normal.';