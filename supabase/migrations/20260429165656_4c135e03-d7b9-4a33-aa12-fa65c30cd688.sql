-- Tabela de configuração de horário de funcionamento (singleton)
CREATE TABLE IF NOT EXISTS public.business_hours_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  timezone TEXT NOT NULL DEFAULT 'America/Sao_Paulo',
  -- Schedule por dia da semana (0=domingo .. 6=sabado)
  -- JSON: { "0": { enabled: false, open: "08:00", close: "18:00", lunch_start: null, lunch_end: null }, ... }
  schedule JSONB NOT NULL DEFAULT '{
    "0": {"enabled": false, "open": "08:00", "close": "18:00", "lunch_start": null, "lunch_end": null},
    "1": {"enabled": true,  "open": "08:00", "close": "18:00", "lunch_start": "12:00", "lunch_end": "13:00"},
    "2": {"enabled": true,  "open": "08:00", "close": "18:00", "lunch_start": "12:00", "lunch_end": "13:00"},
    "3": {"enabled": true,  "open": "08:00", "close": "18:00", "lunch_start": "12:00", "lunch_end": "13:00"},
    "4": {"enabled": true,  "open": "08:00", "close": "18:00", "lunch_start": "12:00", "lunch_end": "13:00"},
    "5": {"enabled": true,  "open": "08:00", "close": "18:00", "lunch_start": "12:00", "lunch_end": "13:00"},
    "6": {"enabled": false, "open": "08:00", "close": "12:00", "lunch_start": null, "lunch_end": null}
  }'::jsonb,
  -- Mensagem enviada quando chega contato fora do horário
  out_of_hours_message TEXT NOT NULL DEFAULT 'Olá! No momento estamos fora do horário de atendimento. Retornaremos seu contato assim que possível durante o nosso horário comercial. Obrigado!',
  -- Evita reenviar a mesma mensagem para o mesmo contato em curto período (minutos)
  cooldown_minutes INTEGER NOT NULL DEFAULT 120,
  -- Datas especiais (feriados) que sobrescrevem o schedule. Array de "YYYY-MM-DD"
  holidays JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID
);

ALTER TABLE public.business_hours_settings ENABLE ROW LEVEL SECURITY;

-- Todos autenticados podem ler
CREATE POLICY "Authenticated can read business hours"
ON public.business_hours_settings FOR SELECT
TO authenticated
USING (true);

-- Apenas admin/gestor pode inserir/atualizar
CREATE POLICY "Admin/Gestor can insert business hours"
ON public.business_hours_settings FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Admin/Gestor can update business hours"
ON public.business_hours_settings FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

CREATE TRIGGER trg_business_hours_updated
BEFORE UPDATE ON public.business_hours_settings
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Log de envios da mensagem fora de hora (para cooldown e auditoria)
CREATE TABLE IF NOT EXISTS public.out_of_hours_message_log (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  contact_phone TEXT NOT NULL,
  chat_id TEXT,
  message_sent TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ooh_log_phone_sent ON public.out_of_hours_message_log(contact_phone, sent_at DESC);

ALTER TABLE public.out_of_hours_message_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read ooh log"
ON public.out_of_hours_message_log FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Authenticated can insert ooh log"
ON public.out_of_hours_message_log FOR INSERT
TO authenticated
WITH CHECK (true);

-- Seed singleton
INSERT INTO public.business_hours_settings (is_enabled)
SELECT false
WHERE NOT EXISTS (SELECT 1 FROM public.business_hours_settings);