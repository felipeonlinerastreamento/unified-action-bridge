CREATE OR REPLACE FUNCTION public._gamif_importing() RETURNS boolean
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT coalesce(current_setting('gamif.importing', true), '') = 'on'
$$;

CREATE OR REPLACE FUNCTION public._gamif_notify_user(_user uuid, _title text, _body text) RETURNS void
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO public.gamif_user_notifications(user_id, title, body)
  SELECT _user, _title, _body WHERE _user IS NOT NULL AND public.gamif_setting_on('notifications_enabled') AND NOT public._gamif_importing()
$$;
REVOKE EXECUTE ON FUNCTION public._gamif_notify_user(uuid, text, text) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.gamif_mission_notify() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status = 'ativa' AND NOT public._gamif_importing() AND public.gamif_setting_on('notifications_enabled') AND public.gamif_setting_on('notify_new_mission') THEN
    INSERT INTO public.gamif_user_notifications(user_id, title, body)
    SELECT p.user_id, 'Nova missão: ' || NEW.title, coalesce(NEW.description, '')
    FROM public.profiles p
    WHERE coalesce(p.is_active, true) AND p.user_id IS NOT NULL
      AND (NEW.target_sector_id IS NULL OR EXISTS (SELECT 1 FROM public.user_sector_assignments usa WHERE usa.user_id = p.user_id AND usa.sector_id = NEW.target_sector_id));
  END IF;
  RETURN NULL;
END $$;

CREATE TABLE public.gamif_import_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ran_by uuid,
  exported_at timestamptz,
  report jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gamif_import_runs TO authenticated;
GRANT ALL ON public.gamif_import_runs TO service_role;
ALTER TABLE public.gamif_import_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gamif managers all" ON public.gamif_import_runs FOR ALL TO authenticated USING (public.gamif_is_manager()) WITH CHECK (public.gamif_is_manager());

-- Diretório para ligar usuários do TOP por e-mail (somente admin)
CREATE OR REPLACE FUNCTION public.gamif_import_directory() RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores importam dados do TOP'; END IF;
  RETURN jsonb_build_object(
    'users', coalesce((SELECT jsonb_agg(jsonb_build_object('user_id', p.user_id, 'email', u.email, 'name', p.name, 'is_active', p.is_active))
                       FROM public.profiles p JOIN auth.users u ON u.id = p.user_id), '[]'::jsonb),
    'sectors', coalesce((SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name)) FROM public.sectors s), '[]'::jsonb),
    'links', coalesce((SELECT jsonb_agg(jsonb_build_object('legacy_id', l.legacy_id, 'user_id', l.user_id, 'status', l.status)) FROM public.gamif_legacy_users l), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.gamif_import_directory() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamif_import_directory() TO authenticated;

-- Grava os dados já preparados do TOP (ids originais, idempotente)
CREATE OR REPLACE FUNCTION public.gamif_import_top_apply(_p jsonb) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  present jsonb := '{}'::jsonb;
  c integer;
  k text; tbl text; idcol text;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores importam dados do TOP'; END IF;
  PERFORM set_config('gamif.importing', 'on', true);

  INSERT INTO public.gamif_legacy_users(legacy_id, email, name, user_id, status, coins, xp, raw, created_at)
  SELECT legacy_id, email, name, user_id, status, coins, xp, coalesce(raw, '{}'::jsonb), coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_legacy_users, coalesce(_p->'legacy_users', '[]'))
  ON CONFLICT (legacy_id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name, coins = EXCLUDED.coins, xp = EXCLUDED.xp, raw = EXCLUDED.raw,
    user_id = CASE WHEN gamif_legacy_users.status = 'ligado' THEN gamif_legacy_users.user_id ELSE EXCLUDED.user_id END,
    status = CASE WHEN gamif_legacy_users.status = 'ligado' THEN 'ligado' ELSE EXCLUDED.status END;

  INSERT INTO public.gamif_metric_categories(id, name, position, created_at)
  SELECT id, name, coalesce(position, 0), coalesce(created_at, now()) FROM jsonb_populate_recordset(null::public.gamif_metric_categories, coalesce(_p->'metric_categories', '[]'))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, position = EXCLUDED.position;

  INSERT INTO public.gamif_metrics(id, category_id, name, description, metric_type, coins, xp, is_active, created_at)
  SELECT id, category_id, name, description, metric_type, coins, xp, is_active, coalesce(created_at, now()) FROM jsonb_populate_recordset(null::public.gamif_metrics, coalesce(_p->'metrics', '[]'))
  ON CONFLICT (id) DO UPDATE SET category_id = EXCLUDED.category_id, name = EXCLUDED.name, description = EXCLUDED.description, metric_type = EXCLUDED.metric_type, coins = EXCLUDED.coins, xp = EXCLUDED.xp, is_active = EXCLUDED.is_active;

  -- regra automática entra desligada; se alguém ligar no GS Hub, a importação não desliga
  INSERT INTO public.gamif_auto_rules(id, sector_id, metric_id, weekdays, is_active, created_at)
  SELECT id, sector_id, metric_id, coalesce(weekdays, ARRAY[1,2,3,4,5]), false, coalesce(created_at, now()) FROM jsonb_populate_recordset(null::public.gamif_auto_rules, coalesce(_p->'auto_rules', '[]'))
  ON CONFLICT (id) DO UPDATE SET sector_id = EXCLUDED.sector_id, metric_id = EXCLUDED.metric_id;

  INSERT INTO public.gamif_entries(id, user_id, legacy_user_id, metric_id, metric_name, entry_date, coins, xp, notes, source, acknowledged, created_by, created_at)
  SELECT id, user_id, legacy_user_id, metric_id, metric_name, entry_date, coins, xp, notes, source, coalesce(acknowledged, true), created_by, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_entries, coalesce(_p->'entries', '[]') || coalesce(_p->'adjustments', '[]'))
  ON CONFLICT (id) DO UPDATE SET user_id = coalesce(EXCLUDED.user_id, gamif_entries.user_id), legacy_user_id = EXCLUDED.legacy_user_id, metric_id = EXCLUDED.metric_id,
    metric_name = EXCLUDED.metric_name, entry_date = EXCLUDED.entry_date, coins = EXCLUDED.coins, xp = EXCLUDED.xp, notes = EXCLUDED.notes, source = EXCLUDED.source, created_by = EXCLUDED.created_by;

  DELETE FROM public.gamif_entries WHERE source = 'migracao' AND id::text IN (SELECT jsonb_array_elements_text(coalesce(_p->'delete_entry_ids', '[]')));

  INSERT INTO public.gamif_missions(id, title, description, category, mission_type, target, reward_coins, reward_xp, target_sector_id, status, starts_at, expires_at, created_by, created_at)
  SELECT id, title, description, category, mission_type, target, coalesce(reward_coins, 0), coalesce(reward_xp, 0), target_sector_id, status, starts_at, expires_at, created_by, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_missions, coalesce(_p->'missions', '[]'))
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, description = EXCLUDED.description, category = EXCLUDED.category, mission_type = EXCLUDED.mission_type, target = EXCLUDED.target,
    reward_coins = EXCLUDED.reward_coins, reward_xp = EXCLUDED.reward_xp, target_sector_id = EXCLUDED.target_sector_id, status = EXCLUDED.status, expires_at = EXCLUDED.expires_at;

  INSERT INTO public.gamif_user_missions(id, mission_id, user_id, legacy_user_id, progress, status, completed_at, created_at)
  SELECT id, mission_id, user_id, legacy_user_id, coalesce(progress, 0), status, completed_at, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_user_missions, coalesce(_p->'user_missions', '[]'))
  ON CONFLICT (id) DO UPDATE SET user_id = coalesce(EXCLUDED.user_id, gamif_user_missions.user_id), legacy_user_id = EXCLUDED.legacy_user_id, progress = EXCLUDED.progress, status = EXCLUDED.status, completed_at = EXCLUDED.completed_at;

  INSERT INTO public.gamif_store_items(id, name, description, image_url, cost_coins, stock, is_active, created_at)
  SELECT id, name, description, image_url, cost_coins, stock, coalesce(is_active, true), coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_store_items, coalesce(_p->'store_items', '[]'))
  ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, description = EXCLUDED.description, cost_coins = EXCLUDED.cost_coins, stock = EXCLUDED.stock;

  INSERT INTO public.gamif_redemptions(id, item_id, item_name, user_id, legacy_user_id, cost_coins, status, notes, decided_by, decided_at, created_at)
  SELECT id, item_id, item_name, user_id, legacy_user_id, coalesce(cost_coins, 0), status, notes, decided_by, decided_at, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_redemptions, coalesce(_p->'redemptions', '[]'))
  ON CONFLICT (id) DO UPDATE SET item_id = EXCLUDED.item_id, item_name = EXCLUDED.item_name, user_id = coalesce(EXCLUDED.user_id, gamif_redemptions.user_id), legacy_user_id = EXCLUDED.legacy_user_id,
    cost_coins = EXCLUDED.cost_coins, status = EXCLUDED.status, decided_by = EXCLUDED.decided_by, decided_at = EXCLUDED.decided_at;

  INSERT INTO public.gamif_pvp_challenges(id, challenger_id, opponent_id, metric_id, title, description, stake_coins, status, winner_id, starts_at, ends_at, created_at, challenger_vote, opponent_vote, challenger_note, opponent_note, resolved_at)
  SELECT id, challenger_id, opponent_id, metric_id, title, description, coalesce(stake_coins, 0), status, winner_id, starts_at, ends_at, coalesce(created_at, now()), challenger_vote, opponent_vote, challenger_note, opponent_note, resolved_at
  FROM jsonb_populate_recordset(null::public.gamif_pvp_challenges, coalesce(_p->'pvp_challenges', '[]'))
  ON CONFLICT (id) DO UPDATE SET challenger_id = coalesce(EXCLUDED.challenger_id, gamif_pvp_challenges.challenger_id), opponent_id = coalesce(EXCLUDED.opponent_id, gamif_pvp_challenges.opponent_id),
    title = EXCLUDED.title, description = EXCLUDED.description, stake_coins = EXCLUDED.stake_coins, status = EXCLUDED.status, winner_id = coalesce(EXCLUDED.winner_id, gamif_pvp_challenges.winner_id),
    ends_at = EXCLUDED.ends_at, challenger_vote = EXCLUDED.challenger_vote, opponent_vote = EXCLUDED.opponent_vote, challenger_note = EXCLUDED.challenger_note, opponent_note = EXCLUDED.opponent_note, resolved_at = EXCLUDED.resolved_at;

  INSERT INTO public.gamif_suggestions(id, user_id, legacy_user_id, title, description, status, admin_response, created_at)
  SELECT id, user_id, legacy_user_id, title, description, status, admin_response, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_suggestions, coalesce(_p->'suggestions', '[]'))
  ON CONFLICT (id) DO UPDATE SET user_id = coalesce(EXCLUDED.user_id, gamif_suggestions.user_id), legacy_user_id = EXCLUDED.legacy_user_id, title = EXCLUDED.title, description = EXCLUDED.description, status = EXCLUDED.status, admin_response = EXCLUDED.admin_response;

  INSERT INTO public.gamif_suggestion_votes(suggestion_id, user_id, created_at)
  SELECT suggestion_id, user_id, coalesce(created_at, now()) FROM jsonb_populate_recordset(null::public.gamif_suggestion_votes, coalesce(_p->'suggestion_votes', '[]'))
  ON CONFLICT DO NOTHING;

  INSERT INTO public.gamif_streaks(user_id, current_streak, best_streak, last_date)
  SELECT user_id, coalesce(current_streak, 0), coalesce(best_streak, 0), last_date FROM jsonb_populate_recordset(null::public.gamif_streaks, coalesce(_p->'streaks', '[]'))
  ON CONFLICT (user_id) DO UPDATE SET current_streak = EXCLUDED.current_streak, best_streak = EXCLUDED.best_streak, last_date = EXCLUDED.last_date;

  INSERT INTO public.gamif_notifications(id, title, body, target_sector_id, scheduled_at, sent_at, created_by, created_at)
  SELECT id, title, body, target_sector_id, scheduled_at, coalesce(sent_at, created_at, now()), created_by, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_notifications, coalesce(_p->'notifications', '[]'))
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, body = EXCLUDED.body, target_sector_id = EXCLUDED.target_sector_id, sent_at = coalesce(gamif_notifications.sent_at, EXCLUDED.sent_at);

  INSERT INTO public.gamif_user_notifications(id, notification_id, user_id, legacy_user_id, title, body, read_at, created_at)
  SELECT id, notification_id, user_id, legacy_user_id, title, body, read_at, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_user_notifications, coalesce(_p->'user_notifications', '[]'))
  ON CONFLICT (id) DO UPDATE SET user_id = coalesce(EXCLUDED.user_id, gamif_user_notifications.user_id), legacy_user_id = EXCLUDED.legacy_user_id, title = EXCLUDED.title, body = EXCLUDED.body,
    read_at = coalesce(gamif_user_notifications.read_at, EXCLUDED.read_at);

  INSERT INTO public.gamif_processes(id, title, content, sector_id, version, created_by, created_at, updated_at)
  SELECT id, title, content, sector_id, coalesce(version, 1), created_by, coalesce(created_at, now()), coalesce(updated_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_processes, coalesce(_p->'processes', '[]'))
  ON CONFLICT (id) DO UPDATE SET title = EXCLUDED.title, content = EXCLUDED.content, sector_id = EXCLUDED.sector_id, version = greatest(gamif_processes.version, EXCLUDED.version), updated_at = EXCLUDED.updated_at;

  INSERT INTO public.gamif_process_changelog(id, process_id, version, summary, changed_by, created_at)
  SELECT id, process_id, version, summary, changed_by, coalesce(created_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_process_changelog, coalesce(_p->'process_changelog', '[]'))
  ON CONFLICT (id) DO UPDATE SET version = EXCLUDED.version, summary = EXCLUDED.summary, changed_by = EXCLUDED.changed_by;

  INSERT INTO public.gamif_reading_confirmations(id, process_id, user_id, version, confirmed_at)
  SELECT id, process_id, user_id, version, coalesce(confirmed_at, now())
  FROM jsonb_populate_recordset(null::public.gamif_reading_confirmations, coalesce(_p->'reading_confirmations', '[]'))
  ON CONFLICT (id) DO UPDATE SET user_id = EXCLUDED.user_id, version = EXCLUDED.version;

  -- configurações do TOP só preenchem o que ainda não foi definido no GS Hub
  INSERT INTO public.gamif_settings(id, data) VALUES ('default', '{}'::jsonb) ON CONFLICT DO NOTHING;
  UPDATE public.gamif_settings SET data = coalesce(_p->'settings', '{}'::jsonb) || data || jsonb_build_object('top_settings', coalesce(_p->'settings'->'top_settings', '{}'::jsonb)), updated_at = now()
  WHERE id = 'default';

  -- Tarefas do TOP nas Tarefas do GS Hub: entram uma vez e não são sobrescritas depois
  INSERT INTO public.tasks(id, title, description, status, priority, due_date, category_id, created_by, assigned_to, is_group_task, recurrence_type, recurrence_interval, recurrence_end_date, parent_task_id, completed_at, reminder_at, created_at, updated_at)
  SELECT id, title, coalesce(description, ''), status, priority, due_date, NULL, created_by, assigned_to, coalesce(is_group_task, false), recurrence_type, recurrence_interval, recurrence_end_date, parent_task_id, completed_at, reminder_at, coalesce(created_at, now()), coalesce(updated_at, now())
  FROM jsonb_populate_recordset(null::public.tasks, coalesce(_p->'tasks', '[]'))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.task_participants(id, task_id, user_id, created_at)
  SELECT id, task_id, user_id, coalesce(created_at, now()) FROM jsonb_populate_recordset(null::public.task_participants, coalesce(_p->'task_participants', '[]'))
  ON CONFLICT DO NOTHING;

  INSERT INTO public.task_comments(id, task_id, user_id, content, created_at)
  SELECT id, task_id, user_id, content, coalesce(created_at, now()) FROM jsonb_populate_recordset(null::public.task_comments, coalesce(_p->'task_comments', '[]'))
  ON CONFLICT DO NOTHING;

  -- quantos dos registros enviados existem agora no GS Hub
  FOR k, tbl, idcol IN SELECT * FROM (VALUES
    ('legacy_users','gamif_legacy_users','legacy_id'), ('metric_categories','gamif_metric_categories','id'), ('metrics','gamif_metrics','id'),
    ('auto_rules','gamif_auto_rules','id'), ('entries','gamif_entries','id'), ('adjustments','gamif_entries','id'), ('missions','gamif_missions','id'),
    ('user_missions','gamif_user_missions','id'), ('store_items','gamif_store_items','id'), ('redemptions','gamif_redemptions','id'),
    ('pvp_challenges','gamif_pvp_challenges','id'), ('suggestions','gamif_suggestions','id'), ('streaks','gamif_streaks','user_id'),
    ('notifications','gamif_notifications','id'), ('user_notifications','gamif_user_notifications','id'), ('processes','gamif_processes','id'),
    ('process_changelog','gamif_process_changelog','id'), ('reading_confirmations','gamif_reading_confirmations','id'),
    ('tasks','tasks','id'), ('task_participants','task_participants','id'), ('task_comments','task_comments','id')) v(a, b, c)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I::text IN (SELECT x->>%L FROM jsonb_array_elements($1) x)', tbl, idcol, idcol)
      INTO c USING coalesce(_p->k, '[]'::jsonb);
    present := present || jsonb_build_object(k, c);
  END LOOP;
  SELECT count(*) INTO c FROM public.gamif_suggestion_votes v
    WHERE EXISTS (SELECT 1 FROM jsonb_array_elements(coalesce(_p->'suggestion_votes', '[]')) x WHERE x->>'suggestion_id' = v.suggestion_id::text AND x->>'user_id' = v.user_id::text);
  present := present || jsonb_build_object('suggestion_votes', c);

  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'importacao_top', 'gamif_import_runs', NULL, jsonb_build_object('present', present));

  RETURN jsonb_build_object(
    'present', present,
    'balances', coalesce((
      SELECT jsonb_agg(jsonb_build_object('legacy_id', l.legacy_id, 'user_id', l.user_id, 'status', l.status, 'gs_name', p.name,
        'wallet_coins', w.coins, 'wallet_xp', w.xp, 'top_part_coins', s.c, 'top_part_xp', s.x))
      FROM public.gamif_legacy_users l
      LEFT JOIN public.gamif_wallets w ON w.user_id = l.user_id
      LEFT JOIN public.profiles p ON p.user_id = l.user_id
      LEFT JOIN LATERAL (SELECT coalesce(sum(e.coins), 0) c, coalesce(sum(e.xp), 0) x FROM public.gamif_entries e WHERE e.legacy_user_id = l.legacy_id AND e.source IN ('top', 'migracao')) s ON true
    ), '[]'::jsonb)
  );
END $$;
REVOKE EXECUTE ON FUNCTION public.gamif_import_top_apply(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.gamif_import_top_apply(jsonb) TO authenticated;