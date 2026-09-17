-- Settings (thresholds + mute)
CREATE TABLE IF NOT EXISTS public.system_health_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  connections_pct_warn integer NOT NULL DEFAULT 80,
  cache_hit_min_pct numeric NOT NULL DEFAULT 95,
  db_growth_limit_mb integer NOT NULL DEFAULT 2048,
  cron_stale_minutes integer NOT NULL DEFAULT 15,
  integration_fail_threshold integer NOT NULL DEFAULT 2,
  integration_errors_per_hour integer NOT NULL DEFAULT 10,
  alerts_enabled boolean NOT NULL DEFAULT true,
  muted_until timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.system_health_settings TO authenticated;
GRANT ALL ON public.system_health_settings TO service_role;
ALTER TABLE public.system_health_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestor read health settings" ON public.system_health_settings
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));
CREATE POLICY "Admin manage health settings insert" ON public.system_health_settings
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(),'admin'));
CREATE POLICY "Admin manage health settings update" ON public.system_health_settings
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(),'admin'));

CREATE TRIGGER trg_system_health_settings_updated
  BEFORE UPDATE ON public.system_health_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Alert state log (dedupe + history)
CREATE TABLE IF NOT EXISTS public.system_health_alert_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_key text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  title text NOT NULL,
  message text NOT NULL DEFAULT '',
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  is_open boolean NOT NULL DEFAULT true,
  opened_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  last_seen_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_system_health_alert_open ON public.system_health_alert_log (alert_key, is_open);

GRANT SELECT ON public.system_health_alert_log TO authenticated;
GRANT ALL ON public.system_health_alert_log TO service_role;
ALTER TABLE public.system_health_alert_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestor read health alerts" ON public.system_health_alert_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

-- Metric snapshots (growth comparison)
CREATE TABLE IF NOT EXISTS public.system_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  db_size_bytes bigint NOT NULL DEFAULT 0,
  connections integer NOT NULL DEFAULT 0,
  max_connections integer NOT NULL DEFAULT 0,
  cache_hit_pct numeric NOT NULL DEFAULT 0,
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_system_health_snapshots_time ON public.system_health_snapshots (captured_at DESC);

GRANT SELECT ON public.system_health_snapshots TO authenticated;
GRANT ALL ON public.system_health_snapshots TO service_role;
ALTER TABLE public.system_health_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin gestor read health snapshots" ON public.system_health_snapshots
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

-- Helper: caller must be admin or gestor
CREATE OR REPLACE FUNCTION public.sys_can_monitor()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$
  SELECT public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor');
$$;

GRANT EXECUTE ON FUNCTION public.sys_can_monitor() TO authenticated;

CREATE OR REPLACE FUNCTION public.sys_db_health()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.sys_can_monitor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores e gestores';
  END IF;

  SELECT jsonb_build_object(
    'db_size_bytes', pg_database_size(current_database()),
    'connections', (SELECT count(*) FROM pg_stat_activity),
    'active_connections', (SELECT count(*) FROM pg_stat_activity WHERE state = 'active'),
    'idle_in_transaction', (SELECT count(*) FROM pg_stat_activity WHERE state = 'idle in transaction'),
    'max_connections', (SELECT setting::int FROM pg_settings WHERE name = 'max_connections'),
    'cache_hit_pct', (
      SELECT CASE WHEN (blks_hit + blks_read) = 0 THEN 100
        ELSE round((blks_hit::numeric * 100) / (blks_hit + blks_read), 2) END
      FROM pg_stat_database WHERE datname = current_database()
    ),
    'deadlocks', (SELECT deadlocks FROM pg_stat_database WHERE datname = current_database()),
    'rollbacks', (SELECT xact_rollback FROM pg_stat_database WHERE datname = current_database()),
    'commits', (SELECT xact_commit FROM pg_stat_database WHERE datname = current_database()),
    'temp_files', (SELECT temp_files FROM pg_stat_database WHERE datname = current_database()),
    'temp_bytes', (SELECT temp_bytes FROM pg_stat_database WHERE datname = current_database()),
    'stats_since', (SELECT stats_reset FROM pg_stat_database WHERE datname = current_database()),
    'started_at', pg_postmaster_start_time(),
    'longest_query_seconds', (
      SELECT COALESCE(round(EXTRACT(epoch FROM max(now() - query_start))), 0)
      FROM pg_stat_activity WHERE state = 'active' AND query_start IS NOT NULL
    )
  ) INTO v;

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sys_db_health() TO authenticated;

CREATE OR REPLACE FUNCTION public.sys_slow_queries()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v jsonb;
  has_ext boolean;
BEGIN
  IF NOT public.sys_can_monitor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores e gestores';
  END IF;

  SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') INTO has_ext;
  IF NOT has_ext THEN
    RETURN jsonb_build_object('available', false, 'rows', '[]'::jsonb);
  END IF;

  EXECUTE $q$
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT left(query, 220) AS query,
             calls,
             round(mean_exec_time::numeric, 2) AS mean_ms,
             round(total_exec_time::numeric, 2) AS total_ms
      FROM pg_stat_statements
      WHERE query NOT ILIKE '%pg_stat_statements%'
      ORDER BY mean_exec_time DESC
      LIMIT 10
    ) t
  $q$ INTO v;

  RETURN jsonb_build_object('available', true, 'rows', COALESCE(v, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sys_slow_queries() TO authenticated;

CREATE OR REPLACE FUNCTION public.sys_table_sizes()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.sys_can_monitor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores e gestores';
  END IF;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) INTO v FROM (
    SELECT c.relname AS table_name,
           pg_total_relation_size(c.oid) AS total_bytes,
           COALESCE(s.n_live_tup, 0) AS live_rows,
           COALESCE(s.n_dead_tup, 0) AS dead_rows
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    LEFT JOIN pg_stat_user_tables s ON s.relid = c.oid
    WHERE n.nspname = 'public' AND c.relkind = 'r'
    ORDER BY pg_total_relation_size(c.oid) DESC
    LIMIT 15
  ) t;

  RETURN v;
END;
$$;

GRANT EXECUTE ON FUNCTION public.sys_table_sizes() TO authenticated;

CREATE OR REPLACE FUNCTION public.sys_cron_runs()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public', 'pg_catalog'
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT public.sys_can_monitor() THEN
    RAISE EXCEPTION 'Acesso restrito a administradores e gestores';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    RETURN jsonb_build_object('available', false, 'rows', '[]'::jsonb);
  END IF;

  EXECUTE $q$
    SELECT COALESCE(jsonb_agg(t), '[]'::jsonb) FROM (
      SELECT j.jobid,
             j.jobname,
             j.schedule,
             j.active,
             r.status AS last_status,
             r.start_time AS last_run,
             r.end_time AS last_end,
             left(COALESCE(r.return_message, ''), 300) AS last_message,
             (SELECT count(*) FROM cron.job_run_details d
               WHERE d.jobid = j.jobid
                 AND d.start_time > now() - interval '24 hours'
                 AND d.status <> 'succeeded') AS failures_24h
      FROM cron.job j
      LEFT JOIN LATERAL (
        SELECT * FROM cron.job_run_details d
        WHERE d.jobid = j.jobid
        ORDER BY d.start_time DESC LIMIT 1
      ) r ON true
      ORDER BY j.jobname
    ) t
  $q$ INTO v;

  RETURN jsonb_build_object('available', true, 'rows', COALESCE(v, '[]'::jsonb));
END;
$$;

GRANT EXECUTE ON FUNCTION public.sys_cron_runs() TO authenticated;