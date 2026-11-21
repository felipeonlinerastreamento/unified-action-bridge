-- =====================================================================
-- Contratos: modelos, contratos com assinatura eletrônica própria e trilha de auditoria.
-- Acesso: admin/gestor ou grupo de setor com o menu 'contratos' liberado (contratos_allowed()).
-- O signatário externo nunca lê as tabelas: a página pública /contrato/$token usa funções
-- de servidor com service role, liberando o texto só depois do CPF e assinando com código.
-- =====================================================================

CREATE OR REPLACE FUNCTION public.contratos_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT CASE
    WHEN auth.uid() IS NULL THEN false
    WHEN public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'gestor') THEN true
    WHEN EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = auth.uid() AND p.panel_only = true) THEN false
    ELSE EXISTS (
      SELECT 1 FROM public.user_sector_assignments usa
      JOIN public.sectors s ON s.id = usa.sector_id
      JOIN public.sector_groups g ON g.id = s.group_id
      WHERE usa.user_id = auth.uid() AND 'contratos' = ANY (g.allowed_menus)
    )
  END
$$;
REVOKE ALL ON FUNCTION public.contratos_allowed() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.contratos_allowed() TO authenticated, service_role;

CREATE TABLE IF NOT EXISTS public.contratos_modelos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  chave text NOT NULL UNIQUE,          -- 'licenciamento' | 'termo_adesao'
  nome text NOT NULL,
  conteudo text NOT NULL,
  versao int NOT NULL DEFAULT 1,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE SEQUENCE IF NOT EXISTS public.contratos_numero_seq START 1;

CREATE TABLE IF NOT EXISTS public.contratos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  numero int NOT NULL DEFAULT nextval('public.contratos_numero_seq') UNIQUE,
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho','enviado','assinado','cancelado')),
  cliente_nome text NOT NULL,
  cliente_documento text NOT NULL,      -- só números
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  vigencia_inicio date,
  vigencia_meses int NOT NULL DEFAULT 12,
  renovacao_automatica boolean NOT NULL DEFAULT true,
  valor_mensal numeric(14,2),
  valor_implantacao numeric(14,2),
  signatario_nome text,
  signatario_cpf text,                  -- só números; exigido para abrir o link
  signatario_email text,
  signatario_telefone text,
  -- congelados no envio
  conteudo_html text,
  hash_sha256 text,
  modelos_versao jsonb,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  enviado_em timestamptz,
  visualizado_em timestamptz,
  -- evidências da assinatura do contratante
  assinado_em timestamptz,
  assinatura_nome text,
  assinatura_ip text,
  assinatura_user_agent text,
  assinatura_canal text,
  -- contratada e testemunhas (usuários internos)
  contratada_assinado_por uuid,
  contratada_assinado_nome text,
  contratada_assinado_em timestamptz,
  contratada_ip text,
  testemunhas jsonb NOT NULL DEFAULT '[]'::jsonb,
  provedor text NOT NULL DEFAULT 'proprio' CHECK (provedor IN ('proprio','autentique')),
  provedor_documento_id text,
  cancelado_motivo text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contratos_doc_idx ON public.contratos (cliente_documento);
CREATE INDEX IF NOT EXISTS contratos_status_idx ON public.contratos (status);

-- Código de verificação da assinatura: tabela só do servidor (RLS sem política, sem grant ao app),
-- guarda apenas o hash do código.
CREATE TABLE IF NOT EXISTS public.contratos_codigos (
  contrato_id uuid PRIMARY KEY REFERENCES public.contratos(id) ON DELETE CASCADE,
  codigo_hash text NOT NULL,
  expira_em timestamptz NOT NULL,
  tentativas int NOT NULL DEFAULT 0,
  canal text NOT NULL,
  destino text NOT NULL,
  enviados_ultima_hora int NOT NULL DEFAULT 1,
  janela_inicio timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.contratos_codigos ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.contratos_codigos FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.contratos_codigos TO service_role;

CREATE TABLE IF NOT EXISTS public.contratos_eventos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contrato_id uuid NOT NULL REFERENCES public.contratos(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text,
  ip text,
  user_agent text,
  user_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS contratos_eventos_idx ON public.contratos_eventos (contrato_id, created_at);

CREATE OR REPLACE FUNCTION public.contratos_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at := now(); RETURN NEW; END $$;
DROP TRIGGER IF EXISTS contratos_touch ON public.contratos;
CREATE TRIGGER contratos_touch BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.contratos_touch();

-- Depois de enviado, o texto e as evidências só mudam pelo servidor (service role).
CREATE OR REPLACE FUNCTION public.contratos_protege_enviado()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF OLD.status <> 'rascunho' THEN
    RAISE EXCEPTION 'Contrato já enviado: só pode ser alterado pelas ações do sistema.';
  END IF;
  IF NEW.status <> 'rascunho' OR NEW.conteudo_html IS DISTINCT FROM OLD.conteudo_html OR NEW.hash_sha256 IS DISTINCT FROM OLD.hash_sha256
     OR NEW.assinado_em IS DISTINCT FROM OLD.assinado_em OR NEW.token IS DISTINCT FROM OLD.token
     OR NEW.enviado_em IS DISTINCT FROM OLD.enviado_em OR NEW.visualizado_em IS DISTINCT FROM OLD.visualizado_em
     OR NEW.assinatura_nome IS DISTINCT FROM OLD.assinatura_nome OR NEW.assinatura_ip IS DISTINCT FROM OLD.assinatura_ip
     OR NEW.contratada_assinado_por IS DISTINCT FROM OLD.contratada_assinado_por OR NEW.contratada_assinado_em IS DISTINCT FROM OLD.contratada_assinado_em
     OR NEW.testemunhas IS DISTINCT FROM OLD.testemunhas OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Envio e assinatura são feitos pelas ações do sistema.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contratos_protege ON public.contratos;
CREATE TRIGGER contratos_protege BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.contratos_protege_enviado();

-- RLS
ALTER TABLE public.contratos_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contratos_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "contratos_modelos_select" ON public.contratos_modelos;
CREATE POLICY "contratos_modelos_select" ON public.contratos_modelos FOR SELECT TO authenticated USING (public.contratos_allowed());
DROP POLICY IF EXISTS "contratos_modelos_write" ON public.contratos_modelos;
CREATE POLICY "contratos_modelos_write" ON public.contratos_modelos FOR ALL TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'))
  WITH CHECK (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

DROP POLICY IF EXISTS "contratos_select" ON public.contratos;
CREATE POLICY "contratos_select" ON public.contratos FOR SELECT TO authenticated USING (public.contratos_allowed());
DROP POLICY IF EXISTS "contratos_insert" ON public.contratos;
CREATE POLICY "contratos_insert" ON public.contratos FOR INSERT TO authenticated
  WITH CHECK (public.contratos_allowed() AND status = 'rascunho' AND conteudo_html IS NULL AND assinado_em IS NULL
    AND contratada_assinado_por IS NULL AND testemunhas = '[]'::jsonb AND enviado_em IS NULL);
DROP POLICY IF EXISTS "contratos_update" ON public.contratos;
CREATE POLICY "contratos_update" ON public.contratos FOR UPDATE TO authenticated
  USING (public.contratos_allowed()) WITH CHECK (public.contratos_allowed());
DROP POLICY IF EXISTS "contratos_delete" ON public.contratos;
CREATE POLICY "contratos_delete" ON public.contratos FOR DELETE TO authenticated
  USING (public.contratos_allowed() AND status = 'rascunho');

DROP POLICY IF EXISTS "contratos_eventos_select" ON public.contratos_eventos;
CREATE POLICY "contratos_eventos_select" ON public.contratos_eventos FOR SELECT TO authenticated USING (public.contratos_allowed());

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['contratos_modelos','contratos','contratos_eventos','contratos_codigos'] LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
  END LOOP;
END $$;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.contratos_modelos TO authenticated;
GRANT SELECT ON public.contratos_eventos TO authenticated;
GRANT ALL ON public.contratos, public.contratos_modelos, public.contratos_eventos TO service_role;
GRANT USAGE ON SEQUENCE public.contratos_numero_seq TO authenticated, service_role;
