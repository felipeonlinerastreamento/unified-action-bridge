-- Importação do Bom Controle em segundo plano: a API limita ~5 consultas por minuto e o período tem
-- muitas páginas, então a importação roda no servidor (pg_cron a cada minuto) e não depende da aba aberta.

CREATE TABLE IF NOT EXISTS public.fin_bomcontrole_sync (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativo boolean NOT NULL DEFAULT false,
  janelas jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{mes, de, ate}]
  idx int NOT NULL DEFAULT 0,                    -- janela atual
  pagina int NOT NULL DEFAULT 1,
  incluir_clientes_gsystem boolean NOT NULL DEFAULT false,
  user_id uuid,
  totais jsonb NOT NULL DEFAULT '{}'::jsonb,
  iniciado_em timestamptz,
  atualizado_em timestamptz,
  concluido_em timestamptz,
  proximo_em timestamptz,
  ultimo_erro text
);
INSERT INTO public.fin_bomcontrole_sync (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

ALTER TABLE public.fin_bomcontrole_sync ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS fin_bomcontrole_sync_all ON public.fin_bomcontrole_sync;
CREATE POLICY fin_bomcontrole_sync_all ON public.fin_bomcontrole_sync FOR ALL TO authenticated
  USING (public.can_access_finance()) WITH CHECK (public.can_access_finance());
DROP POLICY IF EXISTS "Only active staff" ON public.fin_bomcontrole_sync;
CREATE POLICY "Only active staff" ON public.fin_bomcontrole_sync AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
GRANT SELECT, INSERT, UPDATE ON public.fin_bomcontrole_sync TO authenticated;
GRANT ALL ON public.fin_bomcontrole_sync TO service_role;

DO $$
BEGIN
  PERFORM cron.unschedule('financeiro-bomcontrole');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;

SELECT cron.schedule(
  'financeiro-bomcontrole',
  '* * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gestao.onlinerastreamento.com.br/api/public/hooks/financeiro-bomcontrole',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fin-cron-token', (SELECT token FROM public.fin_cron_token WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  )
  WHERE EXISTS (SELECT 1 FROM public.fin_bomcontrole_sync WHERE id = 1 AND ativo);
  $job$
);
