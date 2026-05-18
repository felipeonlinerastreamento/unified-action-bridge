
-- Settings (singleton) e log da automação "Sem comunicação"
CREATE TABLE IF NOT EXISTS public.no_comm_automation_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  singleton boolean NOT NULL DEFAULT true UNIQUE,
  is_enabled boolean NOT NULL DEFAULT false,
  direction text NOT NULL DEFAULT 'both' CHECK (direction IN ('inbound','outbound','both')),
  footer_template text NOT NULL DEFAULT 'Atendimento de protocolo: {numero do protocolo}',
  keywords text[] NOT NULL DEFAULT ARRAY['placas sem comunicação','atraso de comunicação'],
  match_mode text NOT NULL DEFAULT 'any' CHECK (match_mode IN ('any','all')),
  auto_close boolean NOT NULL DEFAULT true,
  category text NOT NULL DEFAULT 'Sem comunicação',
  final_status text NOT NULL DEFAULT 'finalizado',
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.no_comm_automation_settings (singleton)
VALUES (true)
ON CONFLICT (singleton) DO NOTHING;

ALTER TABLE public.no_comm_automation_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nocomm settings select admin or gestor"
  ON public.no_comm_automation_settings FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'gestor')
      AND EXISTS (
        SELECT 1 FROM public.profiles p
        WHERE p.user_id = auth.uid()
          AND COALESCE(p.can_access_ai_manager, true) = true
      )
    )
  );

CREATE POLICY "nocomm settings update admin"
  ON public.no_comm_automation_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "nocomm settings insert admin"
  ON public.no_comm_automation_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Log de disparos
CREATE TABLE IF NOT EXISTS public.no_comm_automation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chat_id uuid,
  message_id text,
  ticket_id uuid,
  protocol_number integer,
  direction text NOT NULL,
  matched_keyword text,
  message_excerpt text,
  triggered_by uuid,
  triggered_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_no_comm_log_chat_message
  ON public.no_comm_automation_log (chat_id, message_id)
  WHERE message_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_no_comm_log_triggered_at
  ON public.no_comm_automation_log (triggered_at DESC);

ALTER TABLE public.no_comm_automation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "nocomm log select admin or gestor"
  ON public.no_comm_automation_log FOR SELECT
  USING (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'gestor')
  );
