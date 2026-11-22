-- =====================================================================
-- Reconnect (ex-Reconnect Hub): rastreadores que pararam de comunicar.
-- Tabelas rc_* com as mesmas colunas do sistema antigo (para importar o histórico sem perda,
-- mantendo os mesmos ids). Acesso: admin/gestor ou grupo de setor com o menu 'reconnect'.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.reconnect_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') THEN true
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.panel_only = true) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_sector_assignments usa
      JOIN public.sectors s ON s.id = usa.sector_id
      JOIN public.sector_groups g ON g.id = s.group_id
      WHERE usa.user_id = auth.uid() AND 'reconnect' = ANY (g.allowed_menus)
    )
  END
$$;
REVOKE ALL ON FUNCTION public.reconnect_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reconnect_allowed() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.rc_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  name_key text NOT NULL,                 -- nome normalizado (sem acento, minúsculo)
  emails jsonb NOT NULL DEFAULT '[]'::jsonb,
  phones jsonb NOT NULL DEFAULT '[]'::jsonb,
  vehicle_count int NOT NULL DEFAULT 0,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,  -- cliente do Gestão Online
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rc_clients_name_key_uq ON public.rc_clients (name_key);

CREATE TABLE IF NOT EXISTS public.rc_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  last_communication timestamptz,
  days_offline int NOT NULL DEFAULT 0,
  client_name text NOT NULL,
  client_id text NOT NULL,
  observation text NOT NULL DEFAULT '',
  incidences int NOT NULL DEFAULT 1,
  notifications int NOT NULL DEFAULT 0,
  battery_voltage text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now(),
  was_recovered boolean NOT NULL DEFAULT false,
  recovery_count int NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT '',
  import_date date NOT NULL DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rc_vehicles_import_date_idx ON public.rc_vehicles (import_date);
CREATE INDEX IF NOT EXISTS rc_vehicles_plate_idx ON public.rc_vehicles (plate);

CREATE TABLE IF NOT EXISTS public.rc_recovered_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  client_name text NOT NULL,
  client_id text,
  last_days_offline int NOT NULL DEFAULT 0,
  recovered_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rc_recovered_at_idx ON public.rc_recovered_vehicles (recovered_at DESC);

CREATE TABLE IF NOT EXISTS public.rc_vehicle_annotations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plate text NOT NULL,
  client_id text,
  client_name text NOT NULL DEFAULT '',
  observation text NOT NULL,
  created_by uuid,
  created_by_email text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rc_annotations_plate_idx ON public.rc_vehicle_annotations (plate, created_at DESC);

CREATE TABLE IF NOT EXISTS public.rc_notification_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id text NOT NULL,
  client_name text NOT NULL,
  sent_by text NOT NULL,
  sent_at timestamptz NOT NULL DEFAULT now(),
  plates jsonb NOT NULL DEFAULT '[]'::jsonb,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success',
  error_message text NOT NULL DEFAULT '',
  batch_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rc_notification_sent_idx ON public.rc_notification_logs (sent_at DESC);

CREATE TABLE IF NOT EXISTS public.rc_bulk_send_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_name text NOT NULL,
  client_id text NOT NULL,
  plates jsonb NOT NULL DEFAULT '[]'::jsonb,
  channels jsonb NOT NULL DEFAULT '[]'::jsonb,
  template_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'success',
  error_message text NOT NULL DEFAULT '',
  sent_by text NOT NULL DEFAULT '',
  batch_id text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rc_import_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_at timestamptz NOT NULL DEFAULT now(),
  imported_by text NOT NULL DEFAULT '',
  user_id uuid,
  total_rows int NOT NULL DEFAULT 0,
  new_vehicles int NOT NULL DEFAULT 0,
  updated_vehicles int NOT NULL DEFAULT 0,
  skipped_count int NOT NULL DEFAULT 0,
  recovered_count int NOT NULL DEFAULT 0,
  warning_count int NOT NULL DEFAULT 0,
  skipped_details jsonb NOT NULL DEFAULT '[]'::jsonb,
  warning_details jsonb NOT NULL DEFAULT '[]'::jsonb
);
CREATE INDEX IF NOT EXISTS rc_import_history_at_idx ON public.rc_import_history (imported_at DESC);

CREATE TABLE IF NOT EXISTS public.rc_skipped_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  row_number int NOT NULL,
  raw_plate text NOT NULL DEFAULT '',
  raw_client text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  imported_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rc_import_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rc_message_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  subject text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  is_closing_template boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS rc_message_templates_single_closing_idx
  ON public.rc_message_templates ((is_closing_template)) WHERE is_closing_template = true;

CREATE TABLE IF NOT EXISTS public.rc_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,                 -- usuário do Gestão Online (novos registros)
  legacy_user_id uuid,          -- usuário do sistema antigo (histórico importado)
  user_email text NOT NULL DEFAULT '',
  action text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS rc_activity_created_idx ON public.rc_activity_logs (created_at DESC);

-- Conversas da fila antiga (só histórico, somente leitura; o atendimento novo é na Central).
CREATE TABLE IF NOT EXISTS public.rc_legacy_chats (
  id uuid PRIMARY KEY,
  phone text NOT NULL,
  contact_name text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT '',
  assigned_to text,
  last_message_at timestamptz,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Configuração única: canal de WhatsApp (da Central) e caixa de e-mail usados nas notificações.
CREATE TABLE IF NOT EXISTS public.rc_settings (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  whatsapp_channel_id uuid,
  email_channel_id uuid,
  legacy_imported_at timestamptz,
  legacy_import_counts jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.rc_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

-- RLS: tudo exige reconnect_allowed() + política RESTRICTIVE "Only active staff".
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rc_clients','rc_vehicles','rc_recovered_vehicles','rc_vehicle_annotations','rc_notification_logs',
    'rc_bulk_send_logs','rc_import_history','rc_skipped_rows','rc_import_templates','rc_message_templates','rc_activity_logs',
    'rc_legacy_chats','rc_settings']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.reconnect_allowed()) WITH CHECK (public.reconnect_allowed())', t || '_all', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;
