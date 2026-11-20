REVOKE EXECUTE ON FUNCTION public.gamif_import_top_apply(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gamif_import_fix_tasks(jsonb) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.gamif_import_directory() FROM PUBLIC, anon, authenticated;
DROP FUNCTION IF EXISTS public.gamif_import_top_apply(jsonb);
DROP FUNCTION IF EXISTS public.gamif_import_fix_tasks(jsonb);
DROP FUNCTION IF EXISTS public.gamif_import_directory();
COMMENT ON TABLE public.gamif_import_runs IS 'Histórico da importação do TOP Gamific (encerrada na virada); somente leitura pelo app.';