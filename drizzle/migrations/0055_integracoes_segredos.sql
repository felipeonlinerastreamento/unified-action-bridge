-- =====================================================================
-- Segredos de integrações salvos pela tela (Configurações › Integrações).
-- Só o servidor (service role) lê e grava: RLS ligado, sem política e sem grant ao app.
-- A variável de ambiente, quando existe, continua valendo e tem prioridade.
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.integracoes_segredos (
  chave text PRIMARY KEY,           -- ex.: AUTENTIQUE_API_TOKEN, AUTENTIQUE_SANDBOX, AUTENTIQUE_WEBHOOK_SECRET
  valor text NOT NULL,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.integracoes_segredos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.integracoes_segredos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.integracoes_segredos TO service_role;
DROP POLICY IF EXISTS "Only active staff" ON public.integracoes_segredos;
CREATE POLICY "Only active staff" ON public.integracoes_segredos AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());
