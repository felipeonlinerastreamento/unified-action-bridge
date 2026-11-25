-- Gestão de eventos (ex-projeto "Gestão Telemetria e Fadiga"), migrado para o Gestão Online.
-- Parte 1: o banco do projeto antigo reproduzido com prefixo ge_ (tabelas, tipos, funções, gatilhos,
-- políticas), sem o gatilho em auth.users, sem as rotinas agendadas antigas e sem chaves estrangeiras
-- para auth.users (os ids de usuário são remapeados na importação).
-- Parte 2 (fim do arquivo): integração com o Gestão (equipe, clientes externos, empresas, isolamento).

-- ===== 20260526221534_e53397df-87ca-4412-9787-fda35614abb4.sql

-- ==========================================
-- ENUMS
-- ==========================================
CREATE TYPE public.ge_app_role AS ENUM ('admin_platform','admin_client','operator','admin_group');
CREATE TYPE public.ge_api_type AS ENUM ('movias','yuv');
CREATE TYPE public.ge_api_connection_status AS ENUM ('active','inactive','error','never_synced');
CREATE TYPE public.ge_risk_level AS ENUM ('none','low','medium','high','critical');
CREATE TYPE public.ge_event_status AS ENUM ('pending','in_treatment','treated','closed');
CREATE TYPE public.ge_treatment_status AS ENUM ('pending','in_progress','completed');
CREATE TYPE public.ge_notification_type AS ENUM ('email','whatsapp');
CREATE TYPE public.ge_notification_trigger AS ENUM ('immediate','after_treatment','daily_summary');

-- ==========================================
-- HELPER: updated_at trigger
-- ==========================================
CREATE OR REPLACE FUNCTION public.ge_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- ==========================================
-- CLIENTS
-- ==========================================
CREATE TABLE public.ge_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email_contact TEXT,
  phone TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_clients_updated BEFORE UPDATE ON public.ge_clients FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_clients TO authenticated;
GRANT ALL ON public.ge_clients TO service_role;
ALTER TABLE public.ge_clients ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- PROFILES (linked to auth.users)
-- ==========================================
CREATE TABLE public.ge_profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL,
  full_name TEXT,
  client_id UUID REFERENCES public.ge_clients(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.ge_profiles FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_profiles TO authenticated;
GRANT ALL ON public.ge_profiles TO service_role;
ALTER TABLE public.ge_profiles ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- USER ROLES (separate table, prevent escalation)
-- ==========================================
CREATE TABLE public.ge_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.ge_app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.ge_user_roles TO authenticated;
GRANT ALL ON public.ge_user_roles TO service_role;
ALTER TABLE public.ge_user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.ge_has_role(_user_id UUID, _role public.ge_app_role)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ge_user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- get_user_client_id: returns the client_id of the calling user
CREATE OR REPLACE FUNCTION public.ge_get_user_client_id(_user_id UUID)
RETURNS UUID LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT client_id FROM public.ge_profiles WHERE id = _user_id
$$;

-- is_platform_admin
CREATE OR REPLACE FUNCTION public.ge_is_platform_admin(_user_id UUID)
RETURNS BOOLEAN LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ge_user_roles WHERE user_id = _user_id AND role = 'admin_platform')
$$;

-- ==========================================
-- API CONFIGURATIONS
-- ==========================================
CREATE TABLE public.ge_api_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  api_type public.ge_api_type NOT NULL,
  base_url TEXT NOT NULL,
  username TEXT,
  password_encrypted TEXT,
  bearer_token_encrypted TEXT,
  last_sync_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT true,
  connection_status public.ge_api_connection_status NOT NULL DEFAULT 'never_synced',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, api_type)
);
CREATE TRIGGER trg_apicfg_updated BEFORE UPDATE ON public.ge_api_configurations FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_api_configurations TO authenticated;
GRANT ALL ON public.ge_api_configurations TO service_role;
ALTER TABLE public.ge_api_configurations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- EVENTS
-- ==========================================
CREATE TABLE public.ge_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  api_source public.ge_api_type NOT NULL,
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  device_imei TEXT,
  driver_id TEXT,
  driver_name TEXT,
  license_plate TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  event_time TIMESTAMPTZ NOT NULL,
  event_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  risk_level public.ge_risk_level NOT NULL DEFAULT 'low',
  status public.ge_event_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, api_source, external_event_id)
);
CREATE INDEX ge_idx_events_client_time ON public.ge_events(client_id, event_time DESC);
CREATE INDEX ge_idx_events_status ON public.ge_events(status);
CREATE INDEX ge_idx_events_risk ON public.ge_events(risk_level);
CREATE INDEX ge_idx_events_type ON public.ge_events(event_type);
CREATE TRIGGER trg_events_updated BEFORE UPDATE ON public.ge_events FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_events TO authenticated;
GRANT ALL ON public.ge_events TO service_role;
ALTER TABLE public.ge_events ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RISK CONFIGURATIONS
-- ==========================================
CREATE TABLE public.ge_risk_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  threshold_low NUMERIC NOT NULL DEFAULT 0,
  threshold_medium NUMERIC NOT NULL DEFAULT 20,
  threshold_high NUMERIC NOT NULL DEFAULT 50,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(client_id, event_type)
);
CREATE TRIGGER trg_riskcfg_updated BEFORE UPDATE ON public.ge_risk_configurations FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_risk_configurations TO authenticated;
GRANT ALL ON public.ge_risk_configurations TO service_role;
ALTER TABLE public.ge_risk_configurations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TREATMENTS
-- ==========================================
CREATE TABLE public.ge_treatments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.ge_events(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  created_by_user_id UUID NOT NULL,
  assigned_to_user_id UUID,
  treatment_description TEXT NOT NULL,
  treatment_status public.ge_treatment_status NOT NULL DEFAULT 'pending',
  notes TEXT,
  attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
CREATE INDEX ge_idx_treatments_event ON public.ge_treatments(event_id);
CREATE INDEX ge_idx_treatments_client ON public.ge_treatments(client_id);
CREATE TRIGGER trg_treatments_updated BEFORE UPDATE ON public.ge_treatments FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_treatments TO authenticated;
GRANT ALL ON public.ge_treatments TO service_role;
ALTER TABLE public.ge_treatments ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- TREATMENT HISTORY
-- ==========================================
CREATE TABLE public.ge_treatment_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  treatment_id UUID NOT NULL REFERENCES public.ge_treatments(id) ON DELETE CASCADE,
  changed_by_user_id UUID NOT NULL,
  change_type TEXT NOT NULL,
  old_value JSONB,
  new_value JSONB,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ge_idx_treatment_history_treatment ON public.ge_treatment_history(treatment_id);
GRANT SELECT, INSERT ON public.ge_treatment_history TO authenticated;
GRANT ALL ON public.ge_treatment_history TO service_role;
ALTER TABLE public.ge_treatment_history ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- NOTIFICATION CONFIGURATIONS
-- ==========================================
CREATE TABLE public.ge_notification_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  notification_type public.ge_notification_type NOT NULL,
  trigger_type public.ge_notification_trigger NOT NULL,
  trigger_time TIME,
  min_risk_level public.ge_risk_level NOT NULL DEFAULT 'medium',
  recipient_emails JSONB NOT NULL DEFAULT '[]'::jsonb,
  recipient_phones JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TRIGGER trg_notifcfg_updated BEFORE UPDATE ON public.ge_notification_configurations FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_notification_configurations TO authenticated;
GRANT ALL ON public.ge_notification_configurations TO service_role;
ALTER TABLE public.ge_notification_configurations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- NOTIFICATION LOGS
-- ==========================================
CREATE TABLE public.ge_notification_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_config_id UUID REFERENCES public.ge_notification_configurations(id) ON DELETE SET NULL,
  client_id UUID NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.ge_events(id) ON DELETE SET NULL,
  treatment_id UUID REFERENCES public.ge_treatments(id) ON DELETE SET NULL,
  recipient TEXT NOT NULL,
  channel public.ge_notification_type NOT NULL,
  subject TEXT,
  message TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ge_idx_notif_logs_client ON public.ge_notification_logs(client_id, sent_at DESC);
GRANT SELECT, INSERT ON public.ge_notification_logs TO authenticated;
GRANT ALL ON public.ge_notification_logs TO service_role;
ALTER TABLE public.ge_notification_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- AUDIT LOGS
-- ==========================================
CREATE TABLE public.ge_audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  client_id UUID REFERENCES public.ge_clients(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  changes JSONB,
  ip_address TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ge_idx_audit_user ON public.ge_audit_logs(user_id, created_at DESC);
CREATE INDEX ge_idx_audit_client ON public.ge_audit_logs(client_id, created_at DESC);
GRANT SELECT, INSERT ON public.ge_audit_logs TO authenticated;
GRANT ALL ON public.ge_audit_logs TO service_role;
ALTER TABLE public.ge_audit_logs ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- RLS POLICIES
-- ==========================================

-- clients: platform admin all; client admin/operator only own
CREATE POLICY "platform admin all clients" ON public.ge_clients FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "users view own client" ON public.ge_clients FOR SELECT TO authenticated
  USING (id = public.ge_get_user_client_id(auth.uid()));

-- profiles: platform admin all; users see profiles of own client; user sees own profile
CREATE POLICY "platform admin all profiles" ON public.ge_profiles FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "user view own profile" ON public.ge_profiles FOR SELECT TO authenticated
  USING (id = auth.uid());
-- (removido na migração para o Gestão: autoedição permitiria trocar client_id/is_active)
CREATE POLICY "client admin view client profiles" ON public.ge_profiles FOR SELECT TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));

-- user_roles: only platform admin can manage; user can read own
CREATE POLICY "platform admin all roles" ON public.ge_user_roles FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "user read own roles" ON public.ge_user_roles FOR SELECT TO authenticated
  USING (user_id = auth.uid());

-- api_configurations: platform admin all; client admin own client
CREATE POLICY "platform admin all apicfg" ON public.ge_api_configurations FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client admin own apicfg" ON public.ge_api_configurations FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));

-- events: platform admin all; client users view own client
CREATE POLICY "platform admin all events" ON public.ge_events FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client users view own events" ON public.ge_events FOR SELECT TO authenticated
  USING (client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "client users update own events" ON public.ge_events FOR UPDATE TO authenticated
  USING (client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (client_id = public.ge_get_user_client_id(auth.uid()));

-- risk_configurations: platform admin all; client admin own
CREATE POLICY "platform admin all riskcfg" ON public.ge_risk_configurations FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client users view own riskcfg" ON public.ge_risk_configurations FOR SELECT TO authenticated
  USING (client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "client admin manage own riskcfg" ON public.ge_risk_configurations FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));

-- treatments
CREATE POLICY "platform admin all treatments" ON public.ge_treatments FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client users view own treatments" ON public.ge_treatments FOR SELECT TO authenticated
  USING (client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "client users create treatments" ON public.ge_treatments FOR INSERT TO authenticated
  WITH CHECK (client_id = public.ge_get_user_client_id(auth.uid()) AND created_by_user_id = auth.uid());
CREATE POLICY "client users update own treatments" ON public.ge_treatments FOR UPDATE TO authenticated
  USING (client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (client_id = public.ge_get_user_client_id(auth.uid()));

-- treatment_history
CREATE POLICY "platform admin all treatment hist" ON public.ge_treatment_history FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client users view treatment hist" ON public.ge_treatment_history FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ge_treatments t WHERE t.id = treatment_id AND t.client_id = public.ge_get_user_client_id(auth.uid())));
CREATE POLICY "client users insert treatment hist" ON public.ge_treatment_history FOR INSERT TO authenticated
  WITH CHECK (changed_by_user_id = auth.uid());

-- notification_configurations
CREATE POLICY "platform admin all notifcfg" ON public.ge_notification_configurations FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client admin manage own notifcfg" ON public.ge_notification_configurations FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));

-- notification_logs
CREATE POLICY "platform admin all notif logs" ON public.ge_notification_logs FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client users view own notif logs" ON public.ge_notification_logs FOR SELECT TO authenticated
  USING (client_id = public.ge_get_user_client_id(auth.uid()));

-- audit_logs
CREATE POLICY "platform admin all audit" ON public.ge_audit_logs FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "user view own audit" ON public.ge_audit_logs FOR SELECT TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "users insert audit" ON public.ge_audit_logs FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

-- ==========================================
-- TRIGGER: create profile on user signup
-- ==========================================



-- ===== 20260526221601_9fec227e-0623-4715-9aa7-b8b9cd603518.sql

-- Set search_path for the two helper functions
CREATE OR REPLACE FUNCTION public.ge_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;


-- Restrict SECURITY DEFINER functions to authenticated only
REVOKE EXECUTE ON FUNCTION public.ge_has_role(uuid, public.ge_app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ge_get_user_client_id(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.ge_is_platform_admin(uuid) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.ge_set_updated_at() FROM PUBLIC, anon, authenticated;

-- ===== 20260526222351_1230c5bf-6f3a-4f20-ab1d-946d1b4977c6.sql

-- ===== 20260526222428_4725feb5-ca17-4da2-8723-3345bb6b8ff9.sql

-- 1. Tabela client_groups
CREATE TABLE public.ge_client_groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_client_groups TO authenticated;
GRANT ALL ON public.ge_client_groups TO service_role;

-- 2. Colunas group_id (antes das policies que referenciam)
ALTER TABLE public.ge_clients ADD COLUMN group_id uuid REFERENCES public.ge_client_groups(id) ON DELETE SET NULL;
ALTER TABLE public.ge_profiles ADD COLUMN group_id uuid REFERENCES public.ge_client_groups(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ge_idx_clients_group_id ON public.ge_clients(group_id);
CREATE INDEX IF NOT EXISTS ge_idx_profiles_group_id ON public.ge_profiles(group_id);

-- 3. RLS de client_groups
ALTER TABLE public.ge_client_groups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin all client_groups"
  ON public.ge_client_groups FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid()))
  WITH CHECK (public.ge_is_platform_admin(auth.uid()));

CREATE POLICY "users view own group"
  ON public.ge_client_groups FOR SELECT TO authenticated
  USING (id IN (SELECT group_id FROM public.ge_profiles WHERE id = auth.uid() AND group_id IS NOT NULL));

CREATE TRIGGER trg_client_groups_updated_at
  BEFORE UPDATE ON public.ge_client_groups
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();

-- 4. Funções auxiliares
CREATE OR REPLACE FUNCTION public.ge_get_user_group_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT group_id FROM public.ge_profiles WHERE id = _user_id $$;

CREATE OR REPLACE FUNCTION public.ge_user_can_access_client(_user_id uuid, _client_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.ge_is_platform_admin(_user_id)
    OR EXISTS (
      SELECT 1 FROM public.ge_profiles p
      WHERE p.id = _user_id
        AND (
          p.client_id = _client_id
          OR (p.group_id IS NOT NULL AND p.group_id = (SELECT c.group_id FROM public.ge_clients c WHERE c.id = _client_id))
        )
    )
$$;

-- 5. Atualizar policies

-- clients
DROP POLICY IF EXISTS "users view own client" ON public.ge_clients;
CREATE POLICY "users view accessible clients"
  ON public.ge_clients FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), id));

-- events
DROP POLICY IF EXISTS "client users view own events" ON public.ge_events;
DROP POLICY IF EXISTS "client users update own events" ON public.ge_events;
CREATE POLICY "users view accessible events"
  ON public.ge_events FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users update accessible events"
  ON public.ge_events FOR UPDATE TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_user_can_access_client(auth.uid(), client_id));

-- treatments
DROP POLICY IF EXISTS "client users view own treatments" ON public.ge_treatments;
DROP POLICY IF EXISTS "client users update own treatments" ON public.ge_treatments;
DROP POLICY IF EXISTS "client users create treatments" ON public.ge_treatments;
CREATE POLICY "users view accessible treatments"
  ON public.ge_treatments FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users update accessible treatments"
  ON public.ge_treatments FOR UPDATE TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users create accessible treatments"
  ON public.ge_treatments FOR INSERT TO authenticated
  WITH CHECK (public.ge_user_can_access_client(auth.uid(), client_id) AND created_by_user_id = auth.uid());

-- treatment_history
DROP POLICY IF EXISTS "client users view treatment hist" ON public.ge_treatment_history;
CREATE POLICY "users view accessible treatment hist"
  ON public.ge_treatment_history FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ge_treatments t
    WHERE t.id = ge_treatment_history.treatment_id
      AND public.ge_user_can_access_client(auth.uid(), t.client_id)
  ));

-- notification_logs
DROP POLICY IF EXISTS "client users view own notif logs" ON public.ge_notification_logs;
CREATE POLICY "users view accessible notif logs"
  ON public.ge_notification_logs FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));

-- risk_configurations
DROP POLICY IF EXISTS "client users view own riskcfg" ON public.ge_risk_configurations;
CREATE POLICY "users view accessible riskcfg"
  ON public.ge_risk_configurations FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "group admin manage riskcfg"
  ON public.ge_risk_configurations FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));

-- api_configurations
CREATE POLICY "group admin manage apicfg"
  ON public.ge_api_configurations FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));

-- notification_configurations
CREATE POLICY "group admin manage notifcfg"
  ON public.ge_notification_configurations FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));

-- ===== 20260526222448_6456c124-4aec-4faa-a6f2-78ba30746d90.sql

REVOKE ALL ON FUNCTION public.ge_get_user_group_id(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.ge_user_can_access_client(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ge_get_user_group_id(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ge_user_can_access_client(uuid, uuid) TO authenticated, service_role;

-- ===== 20260526223636_25d38a6a-f9bb-4d79-8a80-6db08a32aa00.sql
ALTER TABLE public.ge_api_configurations
  ADD COLUMN IF NOT EXISTS api_key_encrypted text,
  ADD COLUMN IF NOT EXISTS events_endpoint text,
  ADD COLUMN IF NOT EXISTS sync_interval_minutes integer NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS auto_sync_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_test_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_test_status text;
-- ===== 20260526224807_9068fa05-84f7-4fdb-a346-d6ce596cc32b.sql

-- 1. Allow global api_configurations (client_id NULL = platform-wide)
ALTER TABLE public.ge_api_configurations ALTER COLUMN client_id DROP NOT NULL;

-- Unique constraint: only one global config per api_type
CREATE UNIQUE INDEX IF NOT EXISTS ge_api_configurations_global_unique
  ON public.ge_api_configurations (api_type)
  WHERE client_id IS NULL;

-- 2. Staging client flag
ALTER TABLE public.ge_clients ADD COLUMN IF NOT EXISTS is_staging boolean NOT NULL DEFAULT false;

-- Seed staging client (deterministic id)
INSERT INTO public.ge_clients (id, name, is_staging, is_active)
VALUES ('00000000-0000-0000-0000-000000000001', '__staging__ (eventos não mapeados)', true, true)
ON CONFLICT (id) DO NOTHING;

-- 3. client_external_accounts mapping table
CREATE TABLE IF NOT EXISTS public.ge_client_external_accounts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  api_type public.ge_api_type NOT NULL,
  external_account_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_type, external_account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_client_external_accounts TO authenticated;
GRANT ALL ON public.ge_client_external_accounts TO service_role;

ALTER TABLE public.ge_client_external_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin all external accounts"
  ON public.ge_client_external_accounts FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid()))
  WITH CHECK (public.ge_is_platform_admin(auth.uid()));

CREATE POLICY "users view own client external accounts"
  ON public.ge_client_external_accounts FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));

CREATE TRIGGER set_external_accounts_updated
  BEFORE UPDATE ON public.ge_client_external_accounts
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();

-- ===== 20260526230238_e51f3c06-309c-4d84-858a-47680f78293e.sql
UPDATE public.ge_api_configurations SET base_url = 'https://www.movias.com.br:8443', error_message = NULL WHERE api_type = 'movias' AND base_url <> 'https://www.movias.com.br:8443';
-- ===== 20260526230856_b55d4a83-0652-47ca-b5bb-d1c35a35a501.sql
UPDATE public.ge_api_configurations SET base_url = 'https://www.movias.com.br:8443' WHERE api_type = 'movias' AND base_url <> 'https://www.movias.com.br:8443';
-- ===== 20260526231559_32823dae-d17b-4b3b-9324-3002301643c0.sql
ALTER TABLE public.ge_events REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ge_events;
-- ===== 20260526232248_309dc597-9b0a-4e25-b3ef-e2ebdf8ef88f.sql
CREATE POLICY "client admin manage own client profiles"
ON public.ge_profiles
FOR UPDATE
TO authenticated
USING (public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role) AND client_id = public.ge_get_user_client_id(auth.uid()))
WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role) AND client_id = public.ge_get_user_client_id(auth.uid()));
-- ===== 20260526234732_6fe9aee5-c135-48cc-9a83-4fa05eb0ca8f.sql
CREATE TABLE public.ge_client_event_type_settings (
  client_id uuid NOT NULL,
  api_source public.ge_api_type NOT NULL,
  event_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, api_source, event_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_client_event_type_settings TO authenticated;
GRANT ALL ON public.ge_client_event_type_settings TO service_role;

ALTER TABLE public.ge_client_event_type_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin all evt type settings"
ON public.ge_client_event_type_settings FOR ALL TO authenticated
USING (public.ge_is_platform_admin(auth.uid()))
WITH CHECK (public.ge_is_platform_admin(auth.uid()));

CREATE POLICY "users view accessible evt type settings"
ON public.ge_client_event_type_settings FOR SELECT TO authenticated
USING (public.ge_user_can_access_client(auth.uid(), client_id));

CREATE POLICY "client admin manage own evt type settings"
ON public.ge_client_event_type_settings FOR ALL TO authenticated
USING (public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role) AND client_id = public.ge_get_user_client_id(auth.uid()))
WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role) AND client_id = public.ge_get_user_client_id(auth.uid()));

CREATE POLICY "group admin manage evt type settings"
ON public.ge_client_event_type_settings FOR ALL TO authenticated
USING (public.ge_has_role(auth.uid(), 'admin_group'::public.ge_app_role) AND public.ge_user_can_access_client(auth.uid(), client_id))
WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group'::public.ge_app_role) AND public.ge_user_can_access_client(auth.uid(), client_id));

CREATE TRIGGER set_evt_type_settings_updated_at
BEFORE UPDATE ON public.ge_client_event_type_settings
FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
-- ===== 20260527000022_6c9128ac-1277-411c-9de7-130cbf6a1a32.sql

CREATE TABLE public.ge_unmatched_event_type_settings (
  api_source public.ge_api_type NOT NULL,
  event_type text NOT NULL,
  is_enabled boolean NOT NULL DEFAULT false,
  first_seen_at timestamptz NOT NULL DEFAULT now(),
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  occurrences integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (api_source, event_type)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_unmatched_event_type_settings TO authenticated;
GRANT ALL ON public.ge_unmatched_event_type_settings TO service_role;

ALTER TABLE public.ge_unmatched_event_type_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin all unmatched type settings"
ON public.ge_unmatched_event_type_settings
FOR ALL TO authenticated
USING (public.ge_is_platform_admin(auth.uid()))
WITH CHECK (public.ge_is_platform_admin(auth.uid()));

CREATE TRIGGER trg_unmatched_type_settings_updated
BEFORE UPDATE ON public.ge_unmatched_event_type_settings
FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();


CREATE TABLE public.ge_unmatched_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  api_source public.ge_api_type NOT NULL,
  external_event_id text NOT NULL,
  event_type text NOT NULL,
  event_time timestamptz NOT NULL,
  company_name text,
  external_account_id text,
  device_imei text,
  driver_id text,
  driver_name text,
  license_plate text,
  latitude double precision,
  longitude double precision,
  event_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (api_source, external_event_id)
);

CREATE INDEX ge_idx_unmatched_events_created_at ON public.ge_unmatched_events (created_at);
CREATE INDEX ge_idx_unmatched_events_api_source ON public.ge_unmatched_events (api_source);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_unmatched_events TO authenticated;
GRANT ALL ON public.ge_unmatched_events TO service_role;

ALTER TABLE public.ge_unmatched_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin all unmatched events"
ON public.ge_unmatched_events
FOR ALL TO authenticated
USING (public.ge_is_platform_admin(auth.uid()))
WITH CHECK (public.ge_is_platform_admin(auth.uid()));

-- ===== 20260527213520_5a6b4d39-8d17-4042-9121-99e9d8faa957.sql
ALTER TABLE public.ge_api_configurations ADD COLUMN IF NOT EXISTS sync_device_cursor integer NOT NULL DEFAULT 0;
-- ===== 20260527215026_9a490609-2c15-4212-9865-1e4ea2dc7f73.sql





-- ===== 20260527215918_737d315b-4e81-4bb7-91b6-70686b03b427.sql





-- ===== 20260527222048_1e0aee7f-4661-4059-9dbc-c9c115b48f55.sql
-- Add new risk levels



-- Extend risk_configurations with new rule fields
ALTER TABLE public.ge_risk_configurations
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS rule_type text,
  ADD COLUMN IF NOT EXISTS min_percent numeric,
  ADD COLUMN IF NOT EXISTS max_percent numeric,
  ADD COLUMN IF NOT EXISTS min_duration_seconds integer,
  ADD COLUMN IF NOT EXISTS min_count integer,
  ADD COLUMN IF NOT EXISTS max_count integer,
  ADD COLUMN IF NOT EXISTS risk_level public.ge_risk_level,
  ADD COLUMN IF NOT EXISTS priority integer NOT NULL DEFAULT 0;

ALTER TABLE public.ge_risk_configurations
  ALTER COLUMN threshold_low DROP NOT NULL,
  ALTER COLUMN threshold_medium DROP NOT NULL,
  ALTER COLUMN threshold_high DROP NOT NULL;
-- ===== 20260527224036_9506f342-7bab-468a-9bda-256e68c978ef.sql
ALTER TABLE public.ge_risk_configurations DROP CONSTRAINT IF EXISTS ge_risk_configurations_client_id_event_type_key;
-- ===== 20260527234025_256b9816-b557-4be7-be9c-10233d24674e.sql


-- ===== 20260528133831_0e0c60ae-2cb8-4c5d-bab7-1b76f7453c6d.sql
CREATE TABLE public.ge_drivers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  client_id uuid NOT NULL,
  full_name text NOT NULL,
  cpf text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE (client_id, cpf)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_drivers TO authenticated;
GRANT ALL ON public.ge_drivers TO service_role;

ALTER TABLE public.ge_drivers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "platform admin all drivers"
  ON public.ge_drivers FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid()))
  WITH CHECK (public.ge_is_platform_admin(auth.uid()));

CREATE POLICY "users view own client drivers"
  ON public.ge_drivers FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));

CREATE POLICY "client admin manage own drivers"
  ON public.ge_drivers FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role) AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role) AND client_id = public.ge_get_user_client_id(auth.uid()));

CREATE POLICY "group admin manage drivers"
  ON public.ge_drivers FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group'::public.ge_app_role) AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group'::public.ge_app_role) AND public.ge_user_can_access_client(auth.uid(), client_id));

CREATE TRIGGER drivers_set_updated_at
BEFORE UPDATE ON public.ge_drivers
FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
-- ===== 20260529135903_515f03cb-139a-4f53-b575-a7c9edb063e6.sql
alter table public.ge_api_configurations
  add column if not exists sync_devices_cache jsonb not null default '[]'::jsonb,
  add column if not exists sync_devices_cache_at timestamptz;
-- ===== 20260817184554_4734b9aa-df2e-4ce5-b21c-d1f1a80fd462.sql
ALTER TABLE public.ge_drivers ADD COLUMN IF NOT EXISTS license_plate text;
CREATE INDEX IF NOT EXISTS ge_drivers_client_plate_idx ON public.ge_drivers (client_id, license_plate);

ALTER TABLE public.ge_events ADD COLUMN IF NOT EXISTS driver_ref_id uuid REFERENCES public.ge_drivers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS ge_events_driver_ref_idx ON public.ge_events (driver_ref_id);
-- ===== 20260817191849_dfd1ae60-ea1e-4108-8426-63ee3cd43b0b.sql
-- ============ FROTAS ============
CREATE TABLE public.ge_fleets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  name text NOT NULL,
  code text,
  location_name text,
  city text,
  state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ge_fleets_client_name_key ON public.ge_fleets (client_id, lower(name));
CREATE INDEX ge_fleets_client_idx ON public.ge_fleets (client_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_fleets TO authenticated;
GRANT ALL ON public.ge_fleets TO service_role;

CREATE TABLE public.ge_fleet_responsibles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fleet_id uuid NOT NULL REFERENCES public.ge_fleets(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  client_id uuid NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fleet_id, user_id)
);
CREATE INDEX ge_fleet_responsibles_user_idx ON public.ge_fleet_responsibles (user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_fleet_responsibles TO authenticated;
GRANT ALL ON public.ge_fleet_responsibles TO service_role;

CREATE TABLE public.ge_vehicles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  fleet_id uuid REFERENCES public.ge_fleets(id) ON DELETE SET NULL,
  license_plate text,
  chassis text,
  tag text,
  internal_id text,
  location_name text,
  city text,
  state text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX ge_vehicles_client_plate_key ON public.ge_vehicles (client_id, upper(regexp_replace(license_plate, '[^A-Za-z0-9]', '', 'g')))
  WHERE license_plate IS NOT NULL AND license_plate <> '';
CREATE INDEX ge_vehicles_fleet_idx ON public.ge_vehicles (fleet_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_vehicles TO authenticated;
GRANT ALL ON public.ge_vehicles TO service_role;

CREATE TABLE public.ge_vehicle_equipments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.ge_vehicles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  imei text,
  serial_number text,
  tag text,
  device_id text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ge_vehicle_equipments_vehicle_idx ON public.ge_vehicle_equipments (vehicle_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_vehicle_equipments TO authenticated;
GRANT ALL ON public.ge_vehicle_equipments TO service_role;

CREATE TABLE public.ge_vehicle_fleet_transfers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vehicle_id uuid NOT NULL REFERENCES public.ge_vehicles(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  from_fleet_id uuid REFERENCES public.ge_fleets(id) ON DELETE SET NULL,
  to_fleet_id uuid REFERENCES public.ge_fleets(id) ON DELETE SET NULL,
  from_fleet_name text,
  to_fleet_name text,
  transferred_by_user_id uuid,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ge_vehicle_fleet_transfers_vehicle_idx ON public.ge_vehicle_fleet_transfers (vehicle_id, created_at DESC);
GRANT SELECT, INSERT ON public.ge_vehicle_fleet_transfers TO authenticated;
GRANT ALL ON public.ge_vehicle_fleet_transfers TO service_role;

-- ============ COLUNAS DE CORRELAÇÃO ============
ALTER TABLE public.ge_events
  ADD COLUMN vehicle_id uuid REFERENCES public.ge_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN fleet_id uuid REFERENCES public.ge_fleets(id) ON DELETE SET NULL;
CREATE INDEX ge_events_fleet_idx ON public.ge_events (fleet_id);

ALTER TABLE public.ge_treatments
  ADD COLUMN fleet_id uuid REFERENCES public.ge_fleets(id) ON DELETE SET NULL,
  ADD COLUMN fleet_name text,
  ADD COLUMN vehicle_id uuid REFERENCES public.ge_vehicles(id) ON DELETE SET NULL,
  ADD COLUMN vehicle_identifier text,
  ADD COLUMN fleet_responsibles_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb;

-- ============ FUNÇÕES DE VISIBILIDADE ============
CREATE OR REPLACE FUNCTION public.ge_user_is_fleet_restricted(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.ge_is_platform_admin(_user_id)
     AND NOT public.ge_has_role(_user_id, 'admin_client')
     AND NOT public.ge_has_role(_user_id, 'admin_group')
     AND EXISTS (SELECT 1 FROM public.ge_fleet_responsibles fr WHERE fr.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.ge_user_can_view_fleet(_user_id uuid, _fleet_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN NOT public.ge_user_is_fleet_restricted(_user_id) THEN true
    WHEN _fleet_id IS NULL THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.ge_fleet_responsibles fr
      WHERE fr.user_id = _user_id AND fr.fleet_id = _fleet_id
    )
  END
$$;

-- ============ RLS: FROTAS ============
ALTER TABLE public.ge_fleets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin all fleets" ON public.ge_fleets FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client admin manage own fleets" ON public.ge_fleets FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "group admin manage fleets" ON public.ge_fleets FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users view accessible fleets" ON public.ge_fleets FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id) AND public.ge_user_can_view_fleet(auth.uid(), id));

-- ============ RLS: RESPONSÁVEIS ============
ALTER TABLE public.ge_fleet_responsibles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin all fleet responsibles" ON public.ge_fleet_responsibles FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client admin manage own fleet responsibles" ON public.ge_fleet_responsibles FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "group admin manage fleet responsibles" ON public.ge_fleet_responsibles FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users view own fleet responsibilities" ON public.ge_fleet_responsibles FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.ge_user_can_access_client(auth.uid(), client_id));

-- ============ RLS: VEÍCULOS ============
ALTER TABLE public.ge_vehicles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin all vehicles" ON public.ge_vehicles FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client admin manage own vehicles" ON public.ge_vehicles FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "group admin manage vehicles" ON public.ge_vehicles FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users view fleet vehicles" ON public.ge_vehicles FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id) AND public.ge_user_can_view_fleet(auth.uid(), fleet_id));
CREATE POLICY "responsibles transfer fleet vehicles" ON public.ge_vehicles FOR UPDATE TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id) AND public.ge_user_can_view_fleet(auth.uid(), fleet_id))
  WITH CHECK (public.ge_user_can_access_client(auth.uid(), client_id));

-- ============ RLS: EQUIPAMENTOS ============
ALTER TABLE public.ge_vehicle_equipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin all vehicle equipments" ON public.ge_vehicle_equipments FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "client admin manage own vehicle equipments" ON public.ge_vehicle_equipments FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_client') AND client_id = public.ge_get_user_client_id(auth.uid()));
CREATE POLICY "group admin manage vehicle equipments" ON public.ge_vehicle_equipments FOR ALL TO authenticated
  USING (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id))
  WITH CHECK (public.ge_has_role(auth.uid(), 'admin_group') AND public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users view accessible vehicle equipments" ON public.ge_vehicle_equipments FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id)
         AND EXISTS (SELECT 1 FROM public.ge_vehicles v WHERE v.id = vehicle_id AND public.ge_user_can_view_fleet(auth.uid(), v.fleet_id)));

-- ============ RLS: HISTÓRICO DE TRANSFERÊNCIAS ============
ALTER TABLE public.ge_vehicle_fleet_transfers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin all vehicle transfers" ON public.ge_vehicle_fleet_transfers FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "users view accessible vehicle transfers" ON public.ge_vehicle_fleet_transfers FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "users create accessible vehicle transfers" ON public.ge_vehicle_fleet_transfers FOR INSERT TO authenticated
  WITH CHECK (public.ge_user_can_access_client(auth.uid(), client_id));

-- ============ EVENTOS: visibilidade por frota ============
DROP POLICY "users view accessible events" ON public.ge_events;
CREATE POLICY "users view accessible events" ON public.ge_events FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id) AND public.ge_user_can_view_fleet(auth.uid(), fleet_id));

-- ============ TRIGGERS ============
CREATE TRIGGER trg_fleets_updated BEFORE UPDATE ON public.ge_fleets
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
CREATE TRIGGER trg_vehicles_updated BEFORE UPDATE ON public.ge_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();
CREATE TRIGGER trg_vehicle_equipments_updated BEFORE UPDATE ON public.ge_vehicle_equipments
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();

-- Evento -> Veículo -> Frota (pela placa/identificador)
CREATE OR REPLACE FUNCTION public.ge_sync_event_fleet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  norm text;
  v record;
BEGIN
  norm := upper(regexp_replace(coalesce(NEW.license_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  IF char_length(norm) >= 5 THEN
    SELECT id, fleet_id INTO v
    FROM public.ge_vehicles
    WHERE client_id = NEW.client_id
      AND license_plate IS NOT NULL
      AND char_length(upper(regexp_replace(license_plate, '[^A-Za-z0-9]', '', 'g'))) >= 5
      AND (
        upper(regexp_replace(license_plate, '[^A-Za-z0-9]', '', 'g')) = norm
        OR norm LIKE '%' || upper(regexp_replace(license_plate, '[^A-Za-z0-9]', '', 'g')) || '%'
      )
    LIMIT 1;
    IF v.id IS NOT NULL THEN
      NEW.vehicle_id := v.id;
      NEW.fleet_id := v.fleet_id;
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_events_fleet
  BEFORE INSERT OR UPDATE OF license_plate, client_id ON public.ge_events
  FOR EACH ROW EXECUTE FUNCTION public.ge_sync_event_fleet();

-- Novo veículo: vincula eventos existentes da mesma placa
CREATE OR REPLACE FUNCTION public.ge_link_events_to_vehicle()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE norm text;
BEGIN
  norm := upper(regexp_replace(coalesce(NEW.license_plate, ''), '[^A-Za-z0-9]', '', 'g'));
  IF char_length(norm) >= 5 THEN
    UPDATE public.ge_events e
      SET vehicle_id = NEW.id, fleet_id = NEW.fleet_id
    WHERE e.client_id = NEW.client_id
      AND e.license_plate IS NOT NULL
      AND upper(regexp_replace(e.license_plate, '[^A-Za-z0-9]', '', 'g')) LIKE '%' || norm || '%';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vehicle_link_events
  AFTER INSERT ON public.ge_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.ge_link_events_to_vehicle();

-- Transferência de frota: histórico + atualização da visibilidade dos eventos
CREATE OR REPLACE FUNCTION public.ge_on_vehicle_fleet_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.fleet_id IS DISTINCT FROM OLD.fleet_id THEN
    INSERT INTO public.ge_vehicle_fleet_transfers (
      vehicle_id, client_id, from_fleet_id, to_fleet_id, from_fleet_name, to_fleet_name, transferred_by_user_id
    ) VALUES (
      NEW.id, NEW.client_id, OLD.fleet_id, NEW.fleet_id,
      (SELECT name FROM public.ge_fleets WHERE id = OLD.fleet_id),
      (SELECT name FROM public.ge_fleets WHERE id = NEW.fleet_id),
      auth.uid()
    );
    UPDATE public.ge_events SET fleet_id = NEW.fleet_id WHERE vehicle_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_vehicle_fleet_change
  AFTER UPDATE OF fleet_id ON public.ge_vehicles
  FOR EACH ROW EXECUTE FUNCTION public.ge_on_vehicle_fleet_change();

-- Tratativa: congela frota/veículo/responsáveis no histórico
CREATE OR REPLACE FUNCTION public.ge_snapshot_treatment_fleet()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE ev record;
BEGIN
  SELECT vehicle_id, fleet_id, license_plate INTO ev FROM public.ge_events WHERE id = NEW.event_id;
  IF NEW.vehicle_id IS NULL THEN NEW.vehicle_id := ev.vehicle_id; END IF;
  IF NEW.fleet_id IS NULL THEN NEW.fleet_id := ev.fleet_id; END IF;
  IF NEW.vehicle_identifier IS NULL THEN NEW.vehicle_identifier := ev.license_plate; END IF;
  IF NEW.fleet_id IS NOT NULL THEN
    SELECT name INTO NEW.fleet_name FROM public.ge_fleets WHERE id = NEW.fleet_id;
    SELECT coalesce(jsonb_agg(jsonb_build_object('user_id', p.id, 'name', coalesce(p.full_name, p.email))), '[]'::jsonb)
      INTO NEW.fleet_responsibles_snapshot
      FROM public.ge_fleet_responsibles fr
      JOIN public.ge_profiles p ON p.id = fr.user_id
     WHERE fr.fleet_id = NEW.fleet_id;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER trg_treatments_fleet_snapshot
  BEFORE INSERT ON public.ge_treatments
  FOR EACH ROW EXECUTE FUNCTION public.ge_snapshot_treatment_fleet();
-- ===== 20260820124217_057e10cc-5b39-467f-83b4-5e5d193928f9.sql
-- 1. Catálogo de funcionalidades (modelo ADM)
CREATE TABLE public.ge_feature_catalog (
  key text PRIMARY KEY,
  label text NOT NULL,
  parent_key text REFERENCES public.ge_feature_catalog(key) ON DELETE CASCADE,
  description text,
  sort_order integer NOT NULL DEFAULT 100,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.ge_feature_catalog TO authenticated;
GRANT ALL ON public.ge_feature_catalog TO service_role;
ALTER TABLE public.ge_feature_catalog ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated read feature catalog" ON public.ge_feature_catalog FOR SELECT TO authenticated USING (true);
CREATE POLICY "platform admin manage feature catalog" ON public.ge_feature_catalog FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE TRIGGER trg_feature_catalog_updated BEFORE UPDATE ON public.ge_feature_catalog
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();

-- 2. Configuração por cliente
CREATE TABLE public.ge_client_features (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.ge_clients(id) ON DELETE CASCADE,
  feature_key text NOT NULL REFERENCES public.ge_feature_catalog(key) ON DELETE CASCADE,
  is_enabled boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, feature_key)
);
GRANT SELECT ON public.ge_client_features TO authenticated;
GRANT ALL ON public.ge_client_features TO service_role;
ALTER TABLE public.ge_client_features ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users view own client features" ON public.ge_client_features FOR SELECT TO authenticated
  USING (public.ge_user_can_access_client(auth.uid(), client_id));
CREATE POLICY "platform admin manage client features" ON public.ge_client_features FOR ALL TO authenticated
  USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE TRIGGER trg_client_features_updated BEFORE UPDATE ON public.ge_client_features
  FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();

-- 3. Funções de autorização
CREATE OR REPLACE FUNCTION public.ge_client_feature_enabled(_client_id uuid, _feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.ge_client_features cf
    WHERE cf.client_id = _client_id AND cf.feature_key = _feature_key AND cf.is_enabled
  )
$$;

CREATE OR REPLACE FUNCTION public.ge_user_can_use_feature(_user_id uuid, _client_id uuid, _feature_key text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ge_is_platform_admin(_user_id)
      OR (_client_id IS NOT NULL AND public.ge_client_feature_enabled(_client_id, _feature_key))
$$;

-- 4. Semear catálogo
INSERT INTO public.ge_feature_catalog (key, label, parent_key, sort_order) VALUES
  ('events', 'Eventos', NULL, 10),
  ('fleets', 'Frotas', NULL, 20),
  ('reports.operational', 'Relatório Operacional', NULL, 30),
  ('drivers', 'Motoristas', NULL, 40),
  ('risk', 'Categorização de Risco', NULL, 50),
  ('notifications', 'Notificações', NULL, 60);
INSERT INTO public.ge_feature_catalog (key, label, parent_key, sort_order) VALUES
  ('events.telemetry', 'Eventos de Telemetria', 'events', 11),
  ('events.fatigue', 'Eventos de Fadiga', 'events', 12),
  ('risk.telemetry', 'Risco — Telemetria', 'risk', 51),
  ('risk.fatigue', 'Risco — Fadiga', 'risk', 52),
  ('risk.trackers', 'Risco — Rastreadores', 'risk', 53),
  ('risk.breathalyzers', 'Risco — Bafômetros', 'risk', 54),
  ('risk.tag', 'Risco — TAG', 'risk', 55);

-- 5. Migrar configuração atual: manter o que o cliente já usa, bloquear fadiga e módulos em desenvolvimento
INSERT INTO public.ge_client_features (client_id, feature_key, is_enabled)
SELECT c.id, f.key,
  CASE WHEN f.key IN ('events.fatigue', 'risk.fatigue', 'risk.trackers', 'risk.breathalyzers', 'risk.tag')
       THEN false ELSE true END
FROM public.ge_clients c CROSS JOIN public.ge_feature_catalog f
ON CONFLICT (client_id, feature_key) DO NOTHING;

-- 6. Autorização real: eventos de fadiga (api_source = 'yuv') invisíveis para clientes sem a funcionalidade
DROP POLICY IF EXISTS "users view accessible events" ON public.ge_events;
CREATE POLICY "users view accessible events" ON public.ge_events FOR SELECT TO authenticated
USING (
  public.ge_user_can_access_client(auth.uid(), client_id)
  AND public.ge_user_can_view_fleet(auth.uid(), fleet_id)
  AND (api_source <> 'yuv'::public.ge_api_type OR public.ge_user_can_use_feature(auth.uid(), client_id, 'events.fatigue'))
);

DROP POLICY IF EXISTS "users update accessible events" ON public.ge_events;
CREATE POLICY "users update accessible events" ON public.ge_events FOR UPDATE TO authenticated
USING (
  public.ge_user_can_access_client(auth.uid(), client_id)
  AND (api_source <> 'yuv'::public.ge_api_type OR public.ge_user_can_use_feature(auth.uid(), client_id, 'events.fatigue'))
);

-- 7. Tratativas de eventos de fadiga também bloqueadas
DROP POLICY IF EXISTS "users view accessible treatments" ON public.ge_treatments;
CREATE POLICY "users view accessible treatments" ON public.ge_treatments FOR SELECT TO authenticated
USING (
  public.ge_user_can_access_client(auth.uid(), client_id)
  AND EXISTS (SELECT 1 FROM public.ge_events e WHERE e.id = ge_treatments.event_id)
);

DROP POLICY IF EXISTS "users update accessible treatments" ON public.ge_treatments;
CREATE POLICY "users update accessible treatments" ON public.ge_treatments FOR UPDATE TO authenticated
USING (
  public.ge_user_can_access_client(auth.uid(), client_id)
  AND EXISTS (SELECT 1 FROM public.ge_events e WHERE e.id = ge_treatments.event_id)
);

DROP POLICY IF EXISTS "users create accessible treatments" ON public.ge_treatments;
CREATE POLICY "users create accessible treatments" ON public.ge_treatments FOR INSERT TO authenticated
WITH CHECK (
  public.ge_user_can_access_client(auth.uid(), client_id)
  AND EXISTS (SELECT 1 FROM public.ge_events e WHERE e.id = ge_treatments.event_id)
);

-- 8. Categorização de Risco: clientes só veem categorias habilitadas
DROP POLICY IF EXISTS "users view accessible riskcfg" ON public.ge_risk_configurations;
CREATE POLICY "users view accessible riskcfg" ON public.ge_risk_configurations FOR SELECT TO authenticated
USING (
  public.ge_user_can_access_client(auth.uid(), client_id)
  AND (
    category IS NULL
    OR public.ge_user_can_use_feature(auth.uid(), client_id, 'risk.' || category)
    OR (category = 'telemetry' AND public.ge_user_can_use_feature(auth.uid(), client_id, 'risk.telemetry'))
  )
);

DROP POLICY IF EXISTS "client admin manage own riskcfg" ON public.ge_risk_configurations;
CREATE POLICY "client admin manage own riskcfg" ON public.ge_risk_configurations FOR ALL TO authenticated
USING (
  public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role)
  AND client_id = public.ge_get_user_client_id(auth.uid())
  AND (category IS NULL OR public.ge_user_can_use_feature(auth.uid(), client_id, 'risk.' || category))
)
WITH CHECK (
  public.ge_has_role(auth.uid(), 'admin_client'::public.ge_app_role)
  AND client_id = public.ge_get_user_client_id(auth.uid())
  AND (category IS NULL OR public.ge_user_can_use_feature(auth.uid(), client_id, 'risk.' || category))
);

DROP POLICY IF EXISTS "group admin manage riskcfg" ON public.ge_risk_configurations;
CREATE POLICY "group admin manage riskcfg" ON public.ge_risk_configurations FOR ALL TO authenticated
USING (
  public.ge_has_role(auth.uid(), 'admin_group'::public.ge_app_role)
  AND public.ge_user_can_access_client(auth.uid(), client_id)
  AND (category IS NULL OR public.ge_user_can_use_feature(auth.uid(), client_id, 'risk.' || category))
)
WITH CHECK (
  public.ge_has_role(auth.uid(), 'admin_group'::public.ge_app_role)
  AND public.ge_user_can_access_client(auth.uid(), client_id)
  AND (category IS NULL OR public.ge_user_can_use_feature(auth.uid(), client_id, 'risk.' || category))
);
-- ===== 20260820124241_18d82ab5-dae9-4cf1-9c5c-ba1801e9ec9b.sql
REVOKE EXECUTE ON FUNCTION public.ge_client_feature_enabled(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.ge_user_can_use_feature(uuid, uuid, text) FROM anon, authenticated;
-- ===== 20260924174625_85b68f11-2cfb-4535-b197-80a987e24157.sql
CREATE TABLE public.ge_event_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.ge_events(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.ge_clients(id),
  analyzed_by_user_id uuid NOT NULL DEFAULT auth.uid(),
  analysis_description text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ge_idx_event_analyses_event ON public.ge_event_analyses(event_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ge_event_analyses TO authenticated;
GRANT ALL ON public.ge_event_analyses TO service_role;
ALTER TABLE public.ge_event_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "platform admin all analyses" ON public.ge_event_analyses FOR ALL TO authenticated USING (public.ge_is_platform_admin(auth.uid())) WITH CHECK (public.ge_is_platform_admin(auth.uid()));
CREATE POLICY "users view accessible analyses" ON public.ge_event_analyses FOR SELECT TO authenticated USING (public.ge_user_can_access_client(auth.uid(), client_id) AND EXISTS (SELECT 1 FROM public.ge_events e WHERE e.id = event_analyses.event_id));
CREATE POLICY "users create accessible analyses" ON public.ge_event_analyses FOR INSERT TO authenticated WITH CHECK (analyzed_by_user_id = auth.uid() AND public.ge_user_can_access_client(auth.uid(), client_id) AND EXISTS (SELECT 1 FROM public.ge_events e WHERE e.id = event_analyses.event_id));
CREATE TRIGGER trg_event_analyses_updated BEFORE UPDATE ON public.ge_event_analyses FOR EACH ROW EXECUTE FUNCTION public.ge_set_updated_at();

-- =====================================================================================
-- Parte 2 — integração com o Gestão Online
-- =====================================================================================

-- Equipe interna com o menu "gestao-eventos" (ou admin/gestor) enxerga tudo, como o ADM da plataforma antigo.
-- Versão por usuário (vale também em chamadas do servidor com service role, onde auth.uid() é nulo).
CREATE OR REPLACE FUNCTION public.ge_staff_allowed_for(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN _uid IS NULL THEN false
    WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _uid AND p.is_active)
      OR NOT EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id = _uid) THEN false
    WHEN public.has_role(_uid, 'admin') OR public.has_role(_uid, 'gestor') THEN true
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _uid AND p.panel_only = true) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_sector_assignments usa
      JOIN public.sectors s ON s.id = usa.sector_id
      JOIN public.sector_groups g ON g.id = s.group_id
      WHERE usa.user_id = _uid AND 'gestao-eventos' = ANY (g.allowed_menus)
    )
  END
$$;
REVOKE ALL ON FUNCTION public.ge_staff_allowed_for(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ge_staff_allowed_for(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.ge_staff_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ge_staff_allowed_for(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.ge_staff_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ge_staff_allowed() TO authenticated, service_role;

-- Papel do usuário: ge_user_roles (clientes e quem foi cadastrado lá) + equipe liberada = admin_platform.
CREATE OR REPLACE FUNCTION public.ge_has_role(_user_id uuid, _role public.ge_app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ge_user_roles WHERE user_id = _user_id AND role = _role)
      OR (_role = 'admin_platform' AND public.ge_staff_allowed_for(_user_id))
$$;
CREATE OR REPLACE FUNCTION public.ge_is_platform_admin(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.ge_has_role(_user_id, 'admin_platform')
$$;

-- Membro externo (usuário de cliente) ativo.
CREATE OR REPLACE FUNCTION public.ge_is_member()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.ge_profiles WHERE id = auth.uid() AND is_active)
$$;
REVOKE ALL ON FUNCTION public.ge_is_member() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ge_is_member() TO authenticated, service_role;

-- Isolamento: toda tabela ge_ só para equipe ativa ou membro ativo da Gestão de eventos
-- (as tabelas do resto do sistema seguem com "Only active staff", que o cliente externo não passa).
DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r' AND c.relname LIKE 'ge\_%' AND c.relrowsecurity
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Only active staff or GE member" ON public.%I', t.relname);
    EXECUTE format('CREATE POLICY "Only active staff or GE member" ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff() OR public.ge_is_member()) WITH CHECK (public.is_active_staff() OR public.ge_is_member())', t.relname);
  END LOOP;
END $$;

-- Cliente da Gestão de eventos ligado ao mesmo cliente do Gestão (empresa) + id no projeto antigo.
ALTER TABLE public.ge_clients
  ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS documento text;
CREATE INDEX IF NOT EXISTS ge_clients_company_idx ON public.ge_clients (company_id);

-- Usuário externo do cliente: o login cria só o perfil básico do Gestão, SEM papel da equipe
-- (sem papel, is_active_staff() é falso e nada do resto do sistema fica visível).
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', NEW.email, ''));
  IF COALESCE(NEW.raw_user_meta_data->>'tipo', '') <> 'ge_cliente' THEN
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'atendente');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Nomes da equipe nas telas (responsável pela tratativa etc.): a equipe liberada se registra em ge_profiles
-- sem client_id e sem papel (o acesso dela vem de ge_staff_allowed, não desta linha).
CREATE OR REPLACE FUNCTION public.ge_registrar_equipe()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _email text; _nome text;
BEGIN
  IF NOT public.ge_staff_allowed() THEN RETURN; END IF;
  SELECT email INTO _email FROM auth.users WHERE id = auth.uid();
  SELECT name INTO _nome FROM public.profiles WHERE user_id = auth.uid();
  INSERT INTO public.ge_profiles (id, email, full_name, is_active)
  VALUES (auth.uid(), coalesce(_email, ''), _nome, false)
  ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, full_name = EXCLUDED.full_name;
END $$;
REVOKE ALL ON FUNCTION public.ge_registrar_equipe() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ge_registrar_equipe() TO authenticated;

-- Rotina de sincronização das APIs (Movias/YUV) a cada minuto, protegida por token.
CREATE TABLE IF NOT EXISTS public.ge_cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL
);
INSERT INTO public.ge_cron_token (id, token)
VALUES (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.ge_cron_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.ge_cron_token FROM anon, authenticated;
GRANT ALL ON public.ge_cron_token TO service_role;

-- Importação do projeto antigo: de-para de ids de usuários (antigo → Gestão) e ponto de parada.
CREATE TABLE IF NOT EXISTS public.ge_migracao (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  etapa text,
  tabela text,
  pagina int NOT NULL DEFAULT 0,
  usuarios jsonb NOT NULL DEFAULT '{}'::jsonb,
  totais jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz,
  atualizado_em timestamptz,
  concluido_em timestamptz,
  ultimo_erro text,
  sync_ativo boolean NOT NULL DEFAULT false
);
INSERT INTO public.ge_migracao (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE public.ge_migracao ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ge_migracao_admin ON public.ge_migracao;
CREATE POLICY ge_migracao_admin ON public.ge_migracao FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));
GRANT SELECT ON public.ge_migracao TO authenticated;
DROP POLICY IF EXISTS "Only active staff" ON public.ge_migracao;
CREATE POLICY "Only active staff" ON public.ge_migracao AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT ALL ON public.ge_migracao TO service_role;

-- Agendador: busca nas APIs a cada minuto (o hook só age com ge_migracao.sync_ativo = true).
DO $$
BEGIN
  PERFORM cron.unschedule('ge-sync-apis');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
SELECT cron.schedule(
  'ge-sync-apis',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gestao.onlinerastreamento.com.br/api/public/hooks/ge-sync-apis',
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-ge-cron-token', (SELECT token FROM public.ge_cron_token WHERE id = 1)),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (SELECT 1 FROM public.ge_migracao WHERE id = 1 AND sync_ativo);
  $job$
);
