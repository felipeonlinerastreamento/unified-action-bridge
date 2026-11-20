
CREATE OR REPLACE FUNCTION public.gamif_link_legacy_user(_legacy_id text, _user_id uuid) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE l public.gamif_legacy_users; bc integer; bx integer;
BEGIN
  IF NOT public.gamif_is_manager() THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  SELECT * INTO l FROM public.gamif_legacy_users WHERE legacy_id = _legacy_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Usuário do TOP não encontrado'; END IF;
  IF l.status = 'ligado' THEN RAISE EXCEPTION 'Já ligado'; END IF;
  INSERT INTO public.gamif_wallets(user_id) VALUES (_user_id) ON CONFLICT DO NOTHING;
  SELECT coins, xp INTO bc, bx FROM public.gamif_wallets WHERE user_id = _user_id FOR UPDATE;
  UPDATE public.gamif_entries SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_daily_performance SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_user_missions SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_redemptions SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_suggestions SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_user_badges SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_user_notifications SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  UPDATE public.gamif_complementary_activities SET user_id = _user_id WHERE legacy_user_id = _legacy_id AND user_id IS NULL;
  -- saldo final = saldo anterior no GS Hub + saldo que a pessoa tinha no TOP
  UPDATE public.gamif_wallets SET coins = bc + l.coins, xp = bx + l.xp, updated_at = now() WHERE user_id = _user_id;
  UPDATE public.gamif_legacy_users SET user_id = _user_id, status = 'ligado' WHERE legacy_id = _legacy_id;
  INSERT INTO public.gamif_audit_logs(actor_id, action, entity, entity_id, details)
  VALUES (auth.uid(), 'ligar_usuario_top', 'gamif_legacy_users', _legacy_id, jsonb_build_object('user_id', _user_id, 'coins', l.coins, 'xp', l.xp));
END $$;

SELECT cron.schedule('gamif-auto-rules-daily', '50 2 * * *', $$SELECT public.gamif_apply_auto_rules(((now() - interval '3 hours') AT TIME ZONE 'UTC')::date)$$);
