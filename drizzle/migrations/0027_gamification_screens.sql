ALTER TABLE public.gamif_pvp_challenges
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS challenger_vote text,
  ADD COLUMN IF NOT EXISTS opponent_vote text,
  ADD COLUMN IF NOT EXISTS challenger_note text,
  ADD COLUMN IF NOT EXISTS opponent_note text,
  ADD COLUMN IF NOT EXISTS resolved_at timestamptz;

CREATE OR REPLACE FUNCTION public.gamif_setting_on(_key text) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT coalesce((SELECT (data->>_key) IS DISTINCT FROM 'false' FROM public.gamif_settings WHERE id = 'default'), true)
$$;

CREATE OR REPLACE FUNCTION public._gamif_fanout_notification(_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n public.gamif_notifications; c integer;
BEGIN
  SELECT * INTO n FROM public.gamif_notifications WHERE id = _id FOR UPDATE;
  IF NOT FOUND OR n.sent_at IS NOT NULL THEN RETURN 0; END IF;
  INSERT INTO public.gamif_user_notifications(notification_id, user_id, title, body)
  SELECT n.id, p.user_id, n.title, n.body
  FROM public.profiles p
  WHERE coalesce(p.is_active, true) AND p.user_id IS NOT NULL
    AND (n.target_sector_id IS NULL OR EXISTS (SELECT 1 FROM public.user_sector_assignments usa WHERE usa.user_id = p.user_id AND usa.sector_id = n.target_sector_id));
  GET DIAGNOSTICS c = ROW_COUNT;
  UPDATE public.gamif_notifications SET sent_at = now() WHERE id = _id;
  RETURN c;
END $$;
REVOKE EXECUTE ON FUNCTION public._gamif_fanout_notification(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gamif_send_notification(_id uuid) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c integer;
BEGIN
  IF NOT public.gamif_is_manager() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  c := public._gamif_fanout_notification(_id);
  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details) VALUES (auth.uid(), 'aviso_enviado', 'gamif_notifications', _id::text, jsonb_build_object('destinatarios', c));
  RETURN c;
END $$;

-- Entrega avisos agendados já vencidos; chamada quando alguém abre a Gamificação (sem rotina repetida)
CREATE OR REPLACE FUNCTION public.gamif_dispatch_scheduled_notifications() RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r record; total integer := 0;
BEGIN
  IF auth.uid() IS NULL THEN RETURN 0; END IF;
  IF NOT public.gamif_setting_on('notifications_enabled') THEN RETURN 0; END IF;
  FOR r IN SELECT id FROM public.gamif_notifications WHERE sent_at IS NULL AND scheduled_at IS NOT NULL AND scheduled_at <= now() LIMIT 20 LOOP
    total := total + public._gamif_fanout_notification(r.id);
  END LOOP;
  RETURN total;
END $$;
REVOKE EXECUTE ON FUNCTION public.gamif_dispatch_scheduled_notifications() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamif_dispatch_scheduled_notifications() TO authenticated;

CREATE OR REPLACE FUNCTION public._gamif_notify_user(_user uuid, _title text, _body text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.gamif_user_notifications(user_id, title, body)
  SELECT _user, _title, _body WHERE _user IS NOT NULL AND public.gamif_setting_on('notifications_enabled')
$$;
REVOKE EXECUTE ON FUNCTION public._gamif_notify_user(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gamif_mission_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativa' AND public.gamif_setting_on('notifications_enabled') AND public.gamif_setting_on('notify_new_mission') THEN
    INSERT INTO public.gamif_user_notifications(user_id, title, body)
    SELECT p.user_id, 'Nova missão: ' || NEW.title, coalesce(NEW.description, '')
    FROM public.profiles p
    WHERE coalesce(p.is_active, true) AND p.user_id IS NOT NULL
      AND (NEW.target_sector_id IS NULL OR EXISTS (SELECT 1 FROM public.user_sector_assignments usa WHERE usa.user_id = p.user_id AND usa.sector_id = NEW.target_sector_id));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_gamif_mission_notify AFTER INSERT ON public.gamif_missions FOR EACH ROW EXECUTE FUNCTION public.gamif_mission_notify();

CREATE OR REPLACE FUNCTION public.gamif_redemption_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND public.gamif_setting_on('notify_redemption_status') THEN
    PERFORM public._gamif_notify_user(NEW.user_id, 'Resgate ' || NEW.status, coalesce(NEW.item_name, 'Item') || coalesce(' — ' || NEW.notes, ''));
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER trg_gamif_redemption_notify AFTER UPDATE OF status ON public.gamif_redemptions FOR EACH ROW EXECUTE FUNCTION public.gamif_redemption_notify();

CREATE OR REPLACE FUNCTION public.gamif_duel_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM public._gamif_notify_user(NEW.opponent_id, 'Você foi desafiado para um duelo', coalesce(NEW.title, 'Duelo') || ' — ' || NEW.stake_coins || ' moedas');
  RETURN NULL;
END $$;
CREATE TRIGGER trg_gamif_duel_notify AFTER INSERT ON public.gamif_pvp_challenges FOR EACH ROW EXECUTE FUNCTION public.gamif_duel_notify();

CREATE OR REPLACE FUNCTION public._gamif_settle_duel(_id uuid, _winner uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.gamif_pvp_challenges; loser uuid; today date := (now() AT TIME ZONE 'America/Sao_Paulo')::date;
BEGIN
  SELECT * INTO d FROM public.gamif_pvp_challenges WHERE id = _id FOR UPDATE;
  IF _winner IS DISTINCT FROM d.challenger_id AND _winner IS DISTINCT FROM d.opponent_id THEN RAISE EXCEPTION 'Vencedor precisa ser participante'; END IF;
  loser := CASE WHEN _winner = d.challenger_id THEN d.opponent_id ELSE d.challenger_id END;
  IF d.stake_coins > 0 THEN
    INSERT INTO public.gamif_entries(user_id, metric_name, entry_date, coins, xp, source, notes)
    VALUES (_winner, 'Duelo vencido: ' || coalesce(d.title, ''), today, d.stake_coins, 0, 'duelo', d.id::text),
           (loser, 'Duelo perdido: ' || coalesce(d.title, ''), today, -d.stake_coins, 0, 'duelo', d.id::text);
  END IF;
  UPDATE public.gamif_pvp_challenges SET status = 'concluido', winner_id = _winner, resolved_at = now() WHERE id = _id;
  PERFORM public._gamif_notify_user(_winner, 'Você venceu o duelo', coalesce(d.title, '') || ' (+' || d.stake_coins || ' moedas)');
  PERFORM public._gamif_notify_user(loser, 'Duelo encerrado', coalesce(d.title, '') || ' (-' || d.stake_coins || ' moedas)');
END $$;
REVOKE EXECUTE ON FUNCTION public._gamif_settle_duel(uuid, uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gamif_respond_duel(_id uuid, _accept boolean) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.gamif_pvp_challenges; c1 integer; c2 integer;
BEGIN
  SELECT * INTO d FROM public.gamif_pvp_challenges WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duelo não encontrado'; END IF;
  IF d.opponent_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Só o desafiado responde'; END IF;
  IF d.status <> 'pendente' THEN RAISE EXCEPTION 'Duelo não está pendente'; END IF;
  IF _accept THEN
    c1 := coalesce((SELECT coins FROM public.gamif_wallets WHERE user_id = d.challenger_id), 0);
    c2 := coalesce((SELECT coins FROM public.gamif_wallets WHERE user_id = d.opponent_id), 0);
    IF c2 < d.stake_coins THEN RAISE EXCEPTION 'Saldo insuficiente para aceitar (% moedas)', d.stake_coins; END IF;
    IF c1 < d.stake_coins THEN RAISE EXCEPTION 'O desafiante não tem mais saldo para este duelo'; END IF;
    UPDATE public.gamif_pvp_challenges SET status = 'ativo', starts_at = coalesce(starts_at, now()) WHERE id = _id;
  ELSE
    UPDATE public.gamif_pvp_challenges SET status = 'recusado', resolved_at = now() WHERE id = _id;
  END IF;
  PERFORM public._gamif_notify_user(d.challenger_id, CASE WHEN _accept THEN 'Duelo aceito' ELSE 'Duelo recusado' END, coalesce(d.title, ''));
END $$;

CREATE OR REPLACE FUNCTION public.gamif_cancel_duel(_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.gamif_pvp_challenges SET status = 'cancelado', resolved_at = now()
  WHERE id = _id AND status = 'pendente' AND challenger_id = auth.uid();
  IF NOT FOUND THEN RAISE EXCEPTION 'Só o desafiante cancela um duelo pendente'; END IF;
END $$;

CREATE OR REPLACE FUNCTION public.gamif_vote_duel(_id uuid, _claim text, _note text DEFAULT NULL) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.gamif_pvp_challenges;
BEGIN
  IF _claim NOT IN ('venci','perdi') THEN RAISE EXCEPTION 'Resultado inválido'; END IF;
  SELECT * INTO d FROM public.gamif_pvp_challenges WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duelo não encontrado'; END IF;
  IF d.status <> 'ativo' THEN RAISE EXCEPTION 'Duelo não está em andamento'; END IF;
  IF auth.uid() = d.challenger_id THEN
    UPDATE public.gamif_pvp_challenges SET challenger_vote = _claim, challenger_note = _note WHERE id = _id RETURNING * INTO d;
  ELSIF auth.uid() = d.opponent_id THEN
    UPDATE public.gamif_pvp_challenges SET opponent_vote = _claim, opponent_note = _note WHERE id = _id RETURNING * INTO d;
  ELSE
    RAISE EXCEPTION 'Só participantes declaram resultado';
  END IF;
  IF d.challenger_vote IS NULL OR d.opponent_vote IS NULL THEN RETURN 'aguardando'; END IF;
  IF d.challenger_vote = 'venci' AND d.opponent_vote = 'perdi' THEN PERFORM public._gamif_settle_duel(_id, d.challenger_id); RETURN 'concluido'; END IF;
  IF d.challenger_vote = 'perdi' AND d.opponent_vote = 'venci' THEN PERFORM public._gamif_settle_duel(_id, d.opponent_id); RETURN 'concluido'; END IF;
  UPDATE public.gamif_pvp_challenges SET status = 'disputa' WHERE id = _id;
  RETURN 'disputa';
END $$;

CREATE OR REPLACE FUNCTION public.gamif_resolve_duel(_id uuid, _winner uuid DEFAULT NULL) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE d public.gamif_pvp_challenges;
BEGIN
  IF NOT public.gamif_is_manager() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO d FROM public.gamif_pvp_challenges WHERE id = _id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Duelo não encontrado'; END IF;
  IF d.status NOT IN ('pendente','ativo','disputa') THEN RAISE EXCEPTION 'Duelo já encerrado'; END IF;
  IF _winner IS NULL THEN
    UPDATE public.gamif_pvp_challenges SET status = 'cancelado', resolved_at = now() WHERE id = _id;
  ELSE
    PERFORM public._gamif_settle_duel(_id, _winner);
  END IF;
  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), CASE WHEN _winner IS NULL THEN 'duelo_cancelado' ELSE 'duelo_arbitrado' END, 'gamif_pvp_challenges', _id::text, jsonb_build_object('winner_id', _winner));
END $$;

CREATE OR REPLACE FUNCTION public.gamif_save_process(_id uuid, _title text, _content text, _sector_id uuid, _summary text) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE pid uuid; v integer;
BEGIN
  IF NOT public.gamif_is_manager() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF coalesce(trim(_title), '') = '' THEN RAISE EXCEPTION 'Título obrigatório'; END IF;
  IF _id IS NULL THEN
    INSERT INTO public.gamif_processes(title, content, sector_id, created_by) VALUES (_title, _content, _sector_id, auth.uid()) RETURNING id, version INTO pid, v;
  ELSE
    UPDATE public.gamif_processes SET title = _title, content = _content, sector_id = _sector_id, version = version + 1, updated_at = now()
    WHERE id = _id RETURNING id, version INTO pid, v;
    IF NOT FOUND THEN RAISE EXCEPTION 'Processo não encontrado'; END IF;
  END IF;
  INSERT INTO public.gamif_process_changelog(process_id, version, summary, changed_by) VALUES (pid, v, coalesce(nullif(trim(_summary), ''), CASE WHEN v = 1 THEN 'Criação' ELSE 'Atualização' END), auth.uid());
  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details) VALUES (auth.uid(), 'processo_v' || v, 'gamif_processes', pid::text, '{}'::jsonb);
  RETURN pid;
END $$;

CREATE OR REPLACE FUNCTION public.gamif_feed(_limit integer DEFAULT 50)
RETURNS TABLE(kind text, user_id uuid, user_name text, title text, coins integer, at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT * FROM (
    SELECT 'conquista'::text, ub.user_id, p.name, coalesce(b.icon || ' ', '') || b.name, 0, ub.awarded_at
    FROM public.gamif_user_badges ub JOIN public.gamif_badges b ON b.id = ub.badge_id JOIN public.profiles p ON p.user_id = ub.user_id
    UNION ALL
    SELECT 'missao', um.user_id, p.name, m.title, m.reward_coins, um.completed_at
    FROM public.gamif_user_missions um JOIN public.gamif_missions m ON m.id = um.mission_id JOIN public.profiles p ON p.user_id = um.user_id
    WHERE um.status = 'concluida' AND um.completed_at IS NOT NULL
    UNION ALL
    SELECT 'resgate', r.user_id, p.name, coalesce(r.item_name, 'Item'), r.cost_coins, coalesce(r.decided_at, r.created_at)
    FROM public.gamif_redemptions r JOIN public.profiles p ON p.user_id = r.user_id
    WHERE r.status IN ('aprovado','entregue')
    UNION ALL
    SELECT 'duelo', d.winner_id, p.name, coalesce(d.title, 'Duelo'), d.stake_coins, d.resolved_at
    FROM public.gamif_pvp_challenges d JOIN public.profiles p ON p.user_id = d.winner_id
    WHERE d.status = 'concluido' AND d.resolved_at IS NOT NULL
  ) f(kind, user_id, user_name, title, coins, at)
  WHERE auth.uid() IS NOT NULL
  ORDER BY at DESC
  LIMIT least(greatest(coalesce(_limit, 50), 1), 200)
$$;