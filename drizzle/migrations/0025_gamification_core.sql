
CREATE OR REPLACE FUNCTION public.gamif_is_manager() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor')
$$;

CREATE TABLE public.gamif_legacy_users (
  legacy_id text PRIMARY KEY,
  email text,
  name text,
  user_id uuid,
  status text NOT NULL DEFAULT 'pendente',
  coins integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_wallets (
  user_id uuid PRIMARY KEY,
  coins integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_metric_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  position integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_metrics (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.gamif_metric_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  metric_type text NOT NULL DEFAULT 'positivo',
  coins integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_auto_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid REFERENCES public.sectors(id) ON DELETE CASCADE,
  metric_id uuid REFERENCES public.gamif_metrics(id) ON DELETE CASCADE,
  weekdays integer[] NOT NULL DEFAULT ARRAY[1,2,3,4,5],
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_user_id text,
  metric_id uuid REFERENCES public.gamif_metrics(id) ON DELETE SET NULL,
  metric_name text,
  entry_date date NOT NULL DEFAULT current_date,
  coins integer NOT NULL DEFAULT 0,
  xp integer NOT NULL DEFAULT 0,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  auto_rule_id uuid,
  acknowledged boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX gamif_entries_auto_once ON public.gamif_entries(auto_rule_id, user_id, entry_date) WHERE auto_rule_id IS NOT NULL;
CREATE INDEX gamif_entries_user_date ON public.gamif_entries(user_id, entry_date DESC);
CREATE TABLE public.gamif_daily_performance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_user_id text,
  perf_date date NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  category text,
  mission_type text,
  target numeric,
  reward_coins integer NOT NULL DEFAULT 0,
  reward_xp integer NOT NULL DEFAULT 0,
  target_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'ativa',
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_user_missions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  mission_id uuid NOT NULL REFERENCES public.gamif_missions(id) ON DELETE CASCADE,
  user_id uuid,
  legacy_user_id text,
  progress numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'em_andamento',
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_store_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  image_url text,
  cost_coins integer NOT NULL CHECK (cost_coins >= 0),
  stock integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id uuid REFERENCES public.gamif_store_items(id) ON DELETE SET NULL,
  item_name text,
  user_id uuid,
  legacy_user_id text,
  cost_coins integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  notes text,
  decided_by uuid,
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_pvp_challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id uuid,
  opponent_id uuid,
  metric_id uuid REFERENCES public.gamif_metrics(id) ON DELETE SET NULL,
  title text,
  stake_coins integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pendente',
  winner_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_user_id text,
  title text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'nova',
  admin_response text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_suggestion_votes (
  suggestion_id uuid NOT NULL REFERENCES public.gamif_suggestions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (suggestion_id, user_id)
);
CREATE TABLE public.gamif_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  icon text,
  criteria jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_user_badges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_user_id text,
  badge_id uuid REFERENCES public.gamif_badges(id) ON DELETE CASCADE,
  awarded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_streaks (
  user_id uuid PRIMARY KEY,
  current_streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  last_date date
);
CREATE TABLE public.gamif_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  body text,
  target_sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_user_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  notification_id uuid REFERENCES public.gamif_notifications(id) ON DELETE CASCADE,
  user_id uuid,
  legacy_user_id text,
  title text,
  body text,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  content text,
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_process_changelog (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.gamif_processes(id) ON DELETE CASCADE,
  version integer,
  summary text,
  changed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_process_suggestions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.gamif_processes(id) ON DELETE CASCADE,
  user_id uuid,
  content text NOT NULL,
  status text NOT NULL DEFAULT 'nova',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_reading_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  process_id uuid REFERENCES public.gamif_processes(id) ON DELETE CASCADE,
  user_id uuid,
  version integer,
  confirmed_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_activity_checklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_complementary_activities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  legacy_user_id text,
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_role_functions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sector_id uuid REFERENCES public.sectors(id) ON DELETE SET NULL,
  title text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_settings (
  id text PRIMARY KEY DEFAULT 'default',
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE public.gamif_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  action text NOT NULL,
  entity text,
  entity_id text,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Grants
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['gamif_legacy_users','gamif_wallets','gamif_metric_categories','gamif_metrics','gamif_auto_rules','gamif_entries','gamif_daily_performance','gamif_missions','gamif_user_missions','gamif_store_items','gamif_redemptions','gamif_pvp_challenges','gamif_suggestions','gamif_suggestion_votes','gamif_badges','gamif_user_badges','gamif_streaks','gamif_notifications','gamif_user_notifications','gamif_processes','gamif_process_changelog','gamif_process_suggestions','gamif_reading_confirmations','gamif_activity_checklist','gamif_complementary_activities','gamif_role_functions','gamif_settings','gamif_audit_logs']
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "gamif managers all" ON public.%I FOR ALL TO authenticated USING (public.gamif_is_manager()) WITH CHECK (public.gamif_is_manager())', t);
  END LOOP;
  -- catálogos: leitura para todos os logados
  FOREACH t IN ARRAY ARRAY['gamif_metric_categories','gamif_metrics','gamif_missions','gamif_store_items','gamif_badges','gamif_processes','gamif_process_changelog','gamif_activity_checklist','gamif_role_functions','gamif_settings','gamif_suggestions','gamif_suggestion_votes','gamif_pvp_challenges','gamif_wallets','gamif_user_badges','gamif_streaks']
  LOOP
    EXECUTE format('CREATE POLICY "gamif read all" ON public.%I FOR SELECT TO authenticated USING (true)', t);
  END LOOP;
  -- dados pessoais: leitura do próprio
  FOREACH t IN ARRAY ARRAY['gamif_entries','gamif_daily_performance','gamif_user_missions','gamif_redemptions','gamif_user_notifications','gamif_reading_confirmations','gamif_complementary_activities','gamif_process_suggestions']
  LOOP
    EXECUTE format('CREATE POLICY "gamif read own" ON public.%I FOR SELECT TO authenticated USING (user_id = auth.uid())', t);
  END LOOP;
END $$;

CREATE POLICY "gamif own suggestion insert" ON public.gamif_suggestions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'nova' AND admin_response IS NULL);
CREATE POLICY "gamif own vote insert" ON public.gamif_suggestion_votes FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "gamif own vote delete" ON public.gamif_suggestion_votes FOR DELETE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "gamif own duel insert" ON public.gamif_pvp_challenges FOR INSERT TO authenticated WITH CHECK (challenger_id = auth.uid() AND status = 'pendente' AND winner_id IS NULL);
CREATE POLICY "gamif own read confirm" ON public.gamif_reading_confirmations FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "gamif own process suggestion" ON public.gamif_process_suggestions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND status = 'nova');
CREATE POLICY "gamif own notif read" ON public.gamif_user_notifications FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "gamif own entry ack" ON public.gamif_entries FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Colaborador só pode alterar "acknowledged" no próprio lançamento
CREATE OR REPLACE FUNCTION public.gamif_entries_guard() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND auth.uid() IS NOT NULL AND NOT public.gamif_is_manager() THEN
    IF NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.coins <> OLD.coins OR NEW.xp <> OLD.xp
       OR NEW.metric_id IS DISTINCT FROM OLD.metric_id OR NEW.entry_date <> OLD.entry_date THEN
      RAISE EXCEPTION 'Somente gestores alteram lançamentos';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_gamif_entries_guard BEFORE UPDATE ON public.gamif_entries FOR EACH ROW EXECUTE FUNCTION public.gamif_entries_guard();

-- Saldo acompanha os lançamentos
CREATE OR REPLACE FUNCTION public.gamif_entries_wallet() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') AND OLD.user_id IS NOT NULL THEN
    UPDATE public.gamif_wallets SET coins = coins - OLD.coins, xp = xp - OLD.xp, updated_at = now() WHERE user_id = OLD.user_id;
  END IF;
  IF TG_OP IN ('INSERT','UPDATE') AND NEW.user_id IS NOT NULL THEN
    INSERT INTO public.gamif_wallets(user_id, coins, xp) VALUES (NEW.user_id, NEW.coins, NEW.xp)
    ON CONFLICT (user_id) DO UPDATE SET coins = gamif_wallets.coins + EXCLUDED.coins, xp = gamif_wallets.xp + EXCLUDED.xp, updated_at = now();
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_gamif_entries_wallet AFTER INSERT OR UPDATE OF user_id, coins, xp OR DELETE ON public.gamif_entries FOR EACH ROW EXECUTE FUNCTION public.gamif_entries_wallet();

-- Resgate atômico
CREATE OR REPLACE FUNCTION public.gamif_redeem(_item_id uuid) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE it public.gamif_store_items; bal integer; rid uuid;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO it FROM public.gamif_store_items WHERE id = _item_id AND is_active FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Item indisponível'; END IF;
  IF it.stock IS NOT NULL AND it.stock <= 0 THEN RAISE EXCEPTION 'Item sem estoque'; END IF;
  INSERT INTO public.gamif_wallets(user_id) VALUES (auth.uid()) ON CONFLICT DO NOTHING;
  SELECT coins INTO bal FROM public.gamif_wallets WHERE user_id = auth.uid() FOR UPDATE;
  IF bal < it.cost_coins THEN RAISE EXCEPTION 'Saldo insuficiente'; END IF;
  UPDATE public.gamif_wallets SET coins = coins - it.cost_coins, updated_at = now() WHERE user_id = auth.uid();
  IF it.stock IS NOT NULL THEN UPDATE public.gamif_store_items SET stock = stock - 1 WHERE id = it.id; END IF;
  INSERT INTO public.gamif_redemptions(item_id, item_name, user_id, cost_coins) VALUES (it.id, it.name, auth.uid(), it.cost_coins) RETURNING id INTO rid;
  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details) VALUES (auth.uid(), 'resgate', 'gamif_redemptions', rid::text, jsonb_build_object('coins', it.cost_coins));
  RETURN rid;
END $$;

CREATE OR REPLACE FUNCTION public.gamif_decide_redemption(_id uuid, _status text, _notes text DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r public.gamif_redemptions;
BEGIN
  IF NOT public.gamif_is_manager() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF _status NOT IN ('aprovado','recusado','entregue') THEN RAISE EXCEPTION 'Status inválido'; END IF;
  SELECT * INTO r FROM public.gamif_redemptions WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Resgate não encontrado'; END IF;
  IF r.status = 'recusado' THEN RAISE EXCEPTION 'Resgate já recusado'; END IF;
  IF _status = 'recusado' AND r.user_id IS NOT NULL THEN
    UPDATE public.gamif_wallets SET coins = coins + r.cost_coins, updated_at = now() WHERE user_id = r.user_id;
    IF r.item_id IS NOT NULL THEN UPDATE public.gamif_store_items SET stock = stock + 1 WHERE id = r.item_id AND stock IS NOT NULL; END IF;
  END IF;
  UPDATE public.gamif_redemptions SET status = _status, notes = coalesce(_notes, notes), decided_by = auth.uid(), decided_at = now() WHERE id = _id;
  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details) VALUES (auth.uid(), 'resgate_' || _status, 'gamif_redemptions', _id::text, '{}'::jsonb);
END $$;

-- Ranking: só nome, setor e pontuação
CREATE OR REPLACE FUNCTION public.gamif_ranking() RETURNS TABLE(user_id uuid, name text, avatar_url text, sector_id uuid, sector_name text, coins integer, xp integer)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.user_id, p.name, p.avatar_url, s.id, s.name, coalesce(w.coins,0), coalesce(w.xp,0)
  FROM public.profiles p
  LEFT JOIN public.gamif_wallets w ON w.user_id = p.user_id
  LEFT JOIN LATERAL (SELECT usa.sector_id FROM public.user_sector_assignments usa WHERE usa.user_id = p.user_id ORDER BY usa.created_at LIMIT 1) a ON true
  LEFT JOIN public.sectors s ON s.id = a.sector_id
  WHERE coalesce(p.is_active, true) AND auth.uid() IS NOT NULL
  ORDER BY coalesce(w.xp,0) DESC
$$;

-- Regras automáticas diárias (valor fixo por setor), uma vez por usuário/regra/dia
CREATE OR REPLACE FUNCTION public.gamif_apply_auto_rules(_day date DEFAULT (now() AT TIME ZONE 'America/Sao_Paulo')::date) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  INSERT INTO public.gamif_entries(user_id, metric_id, metric_name, entry_date, coins, xp, source, auto_rule_id, notes)
  SELECT usa.user_id, m.id, m.name, _day, m.coins, m.xp, 'auto', r.id, 'Regra automática do setor'
  FROM public.gamif_auto_rules r
  JOIN public.gamif_metrics m ON m.id = r.metric_id AND m.is_active
  JOIN public.user_sector_assignments usa ON usa.sector_id = r.sector_id
  JOIN public.profiles p ON p.user_id = usa.user_id AND coalesce(p.is_active, true)
  WHERE r.is_active AND extract(isodow FROM _day)::int = ANY(r.weekdays)
  ON CONFLICT (auto_rule_id, user_id, entry_date) WHERE auto_rule_id IS NOT NULL DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE EXECUTE ON FUNCTION public.gamif_apply_auto_rules(date) FROM PUBLIC, anon, authenticated;

INSERT INTO public.gamif_settings(id) VALUES ('default') ON CONFLICT DO NOTHING;
