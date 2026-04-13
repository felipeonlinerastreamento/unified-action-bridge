-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'gestor', 'atendente');
CREATE TYPE public.inventory_status AS ENUM ('disponivel', 'vinculado');
CREATE TYPE public.movement_type AS ENUM ('entrada', 'saida');
CREATE TYPE public.ticket_status AS ENUM ('aberto', 'resolvido');

-- Utility functions
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- 1. Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own profile" ON public.profiles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. User Roles
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- has_role function
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can view all profiles" ON public.profiles FOR SELECT USING (public.has_role(auth.uid(), 'admin'));

-- 3. Channels
CREATE TABLE public.channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL, token TEXT NOT NULL, platform TEXT NOT NULL DEFAULT 'whatsapp',
  organization_id TEXT, is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.channels ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage channels" ON public.channels FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users view active channels" ON public.channels FOR SELECT USING (is_active = true AND auth.uid() IS NOT NULL);
CREATE TRIGGER update_channels_updated_at BEFORE UPDATE ON public.channels FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Inventory Categories
CREATE TABLE public.inventory_categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name TEXT NOT NULL UNIQUE, description TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_categories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view categories" ON public.inventory_categories FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins gestors manage categories" ON public.inventory_categories FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 5. Inventory Items
CREATE TABLE public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id UUID NOT NULL REFERENCES public.inventory_categories(id),
  name TEXT NOT NULL, serial_number TEXT UNIQUE,
  status public.inventory_status NOT NULL DEFAULT 'disponivel',
  linked_to TEXT, linked_at TIMESTAMPTZ, notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view items" ON public.inventory_items FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins gestors manage items" ON public.inventory_items FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));
CREATE INDEX idx_inv_items_status ON public.inventory_items(status);
CREATE INDEX idx_inv_items_category ON public.inventory_items(category_id);
CREATE TRIGGER update_inv_items_updated_at BEFORE UPDATE ON public.inventory_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Inventory Movements
CREATE TABLE public.inventory_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.inventory_items(id),
  type public.movement_type NOT NULL, quantity INTEGER NOT NULL DEFAULT 1,
  notes TEXT, created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view movements" ON public.inventory_movements FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins gestors create movements" ON public.inventory_movements FOR INSERT WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 7. Inventory Min Rules
CREATE TABLE public.inventory_min_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_name TEXT NOT NULL, category_id UUID REFERENCES public.inventory_categories(id),
  min_quantity INTEGER NOT NULL DEFAULT 5, auto_ticket BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.inventory_min_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view rules" ON public.inventory_min_rules FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage rules" ON public.inventory_min_rules FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- 8. Auto Tickets
CREATE TABLE public.auto_tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID REFERENCES public.inventory_min_rules(id),
  item_name TEXT NOT NULL, current_quantity INTEGER NOT NULL, min_quantity INTEGER NOT NULL,
  status public.ticket_status NOT NULL DEFAULT 'aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(), resolved_at TIMESTAMPTZ
);
ALTER TABLE public.auto_tickets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view tickets" ON public.auto_tickets FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins gestors manage tickets" ON public.auto_tickets FOR ALL USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor'));

-- 9. Audit Logs
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id), action TEXT NOT NULL,
  entity_type TEXT NOT NULL, entity_id TEXT, details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view audit logs" ON public.audit_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users create audit logs" ON public.audit_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_audit_action ON public.audit_logs(action);
CREATE INDEX idx_audit_entity ON public.audit_logs(entity_type, entity_id);

-- 10. Integration Logs
CREATE TABLE public.integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES public.channels(id), endpoint TEXT NOT NULL,
  method TEXT NOT NULL DEFAULT 'GET', status_code INTEGER,
  response_time_ms INTEGER, error_code TEXT, error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.integration_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins view integration logs" ON public.integration_logs FOR SELECT USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "System insert integration logs" ON public.integration_logs FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE INDEX idx_intlog_channel ON public.integration_logs(channel_id);
CREATE INDEX idx_intlog_error ON public.integration_logs(error_code);

-- 11. Entity Links
CREATE TABLE public.entity_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL, local_id TEXT NOT NULL, external_id TEXT NOT NULL,
  channel_id UUID REFERENCES public.channels(id), metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entity_type, external_id, channel_id)
);
ALTER TABLE public.entity_links ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth users view entity links" ON public.entity_links FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "Admins manage entity links" ON public.entity_links FOR ALL USING (public.has_role(auth.uid(), 'admin'));
CREATE INDEX idx_entity_links_lookup ON public.entity_links(entity_type, external_id);

-- Auto-create profile + default role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, name) VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, ''));
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'atendente');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();