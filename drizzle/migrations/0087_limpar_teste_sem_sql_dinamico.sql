-- limpar_dados_teste sem SQL dinâmico (EXECUTE format): mesmas tabelas e mesmo retorno.
-- O verificador de segurança do Lovable marcava o EXECUTE como risco, embora a lista fosse fixa.
CREATE OR REPLACE FUNCTION public.limpar_dados_teste()
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n int; res jsonb := '{}'::jsonb;
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Somente administradores.'; END IF;
  DELETE FROM public.crm_proposal_links WHERE is_teste;      GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('crm_proposal_links', n);
  DELETE FROM public.technical_service_terms WHERE is_teste; GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('technical_service_terms', n);
  DELETE FROM public.crm_tasks WHERE is_teste;               GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('crm_tasks', n);
  DELETE FROM public.crm_opportunities WHERE is_teste;       GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('crm_opportunities', n);
  DELETE FROM public.contratos WHERE is_teste;               GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('contratos', n);
  DELETE FROM public.service_tickets WHERE is_teste;         GET DIAGNOSTICS n = ROW_COUNT; res := res || jsonb_build_object('service_tickets', n);
  DELETE FROM public.teste_envios;
  RETURN res;
END $$;
REVOKE ALL ON FUNCTION public.limpar_dados_teste() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.limpar_dados_teste() TO authenticated;
