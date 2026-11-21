-- =====================================================================
-- Financeiro: agendamento da importação das faturas do GSystem.
-- O pg_cron chama a rota /api/public/hooks/sync-gsystem-faturas a cada 10 minutos.
-- A rota só começa uma rodada nova 1x por hora; as chamadas de 10 em 10 minutos servem
-- para terminar a rodada em andamento (são muitos clientes e cada chamada roda ~50s).
-- Autenticação: token aleatório em fin_cron_token, legível só pela service role/postgres.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.fin_cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.fin_cron_token ENABLE ROW LEVEL SECURITY;
-- Sem políticas: ninguém do app (anon/authenticated) lê ou grava.
REVOKE ALL ON public.fin_cron_token FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.fin_cron_token TO service_role;
DROP POLICY IF EXISTS "Only active staff" ON public.fin_cron_token;
CREATE POLICY "Only active staff" ON public.fin_cron_token AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

INSERT INTO public.fin_cron_token (id, token)
VALUES (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  PERFORM cron.unschedule('financeiro-faturas-gsystem');
EXCEPTION WHEN OTHERS THEN
  NULL; -- ainda não existia
END $$;

SELECT cron.schedule(
  'financeiro-faturas-gsystem',
  '*/10 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://project--40ab25b5-cec0-4fe2-8de9-27bfd1074392.lovable.app/api/public/hooks/sync-gsystem-faturas',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fin-cron-token', (SELECT token FROM public.fin_cron_token WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);
