-- lovable-cron-fallback-reviewed: avisos diários do RH (08:40 em São Paulo) pedidos pelo usuário
-- =====================================================================
-- RH (menu /rh): colaboradores, faltas e ausências (com atestado), férias, banco de horas,
-- documentos com vencimento, advertências/ocorrências, checklists de admissão e desligamento.
-- Acesso: SOMENTE administradores (rh_allowed() = has_role admin). Arquivos ficam no bucket
-- privado "rh-arquivos", lido e gravado só pelo servidor depois de conferir rh_allowed().
-- =====================================================================
CREATE OR REPLACE FUNCTION public.rh_allowed()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;
REVOKE ALL ON FUNCTION public.rh_allowed() FROM public;
GRANT EXECUTE ON FUNCTION public.rh_allowed() TO authenticated;

CREATE TABLE IF NOT EXISTS public.rh_colaboradores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE,                         -- usuário do sistema (profiles.user_id), quando houver
  nome text NOT NULL,
  cpf text,
  cargo text,
  setor_id uuid,
  gestor_user_id uuid,
  tipo_contrato text NOT NULL DEFAULT 'clt' CHECK (tipo_contrato IN ('clt','pj','estagio','temporario','aprendiz','outro')),
  data_admissao date,
  data_desligamento date,
  motivo_desligamento text,
  situacao text NOT NULL DEFAULT 'ativo' CHECK (situacao IN ('ativo','afastado','desligado')),
  salario numeric(14,2),
  jornada text,                                -- ex.: 44h semanais, seg-sex 8h-18h
  data_nascimento date,
  telefone text,
  email text,
  endereco text,
  contato_emergencia text,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_ausencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('falta_injustificada','falta_justificada','atestado','atraso','saida_antecipada','folga',
    'licenca_maternidade','licenca_paternidade','licenca_casamento','licenca_luto','afastamento_inss','suspensao','outro')),
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  minutos int,                                 -- atrasos e saídas antecipadas
  situacao text NOT NULL DEFAULT 'aprovada' CHECK (situacao IN ('pendente','aprovada','recusada')),
  desconta boolean NOT NULL DEFAULT false,     -- desconta do salário
  arquivo_path text,                           -- atestado/declaração no bucket rh-arquivos
  arquivo_nome text,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);
CREATE INDEX IF NOT EXISTS rh_ausencias_colab_idx ON public.rh_ausencias (colaborador_id, data_inicio);

CREATE TABLE IF NOT EXISTS public.rh_ferias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  aquisitivo_inicio date NOT NULL,             -- período aquisitivo a que as férias se referem
  data_inicio date NOT NULL,
  data_fim date NOT NULL,
  abono_dias int NOT NULL DEFAULT 0,           -- dias vendidos
  situacao text NOT NULL DEFAULT 'planejada' CHECK (situacao IN ('planejada','aprovada','concluida','cancelada')),
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (data_fim >= data_inicio)
);

CREATE TABLE IF NOT EXISTS public.rh_banco_horas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  data date NOT NULL,
  minutos int NOT NULL,                        -- positivo = crédito (hora extra), negativo = débito (compensação)
  tipo text NOT NULL DEFAULT 'extra' CHECK (tipo IN ('extra','compensacao','ajuste','pagamento')),
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_documentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL,                          -- CNH, ASO, NR-10, NR-35, Contrato, RG, CTPS...
  numero text,
  emissao date,
  validade date,
  arquivo_path text,
  arquivo_nome text,
  observacao text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_ocorrencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('advertencia_verbal','advertencia_escrita','suspensao','elogio','feedback','outro')),
  data date NOT NULL,
  motivo text NOT NULL,
  descricao text,
  dias_suspensao int,
  ciente_em date,                              -- data em que o colaborador assinou/ficou ciente
  arquivo_path text,                           -- documento assinado
  arquivo_nome text,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.rh_checklists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  colaborador_id uuid NOT NULL REFERENCES public.rh_colaboradores(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('admissao','desligamento')),
  itens jsonb NOT NULL DEFAULT '[]'::jsonb,    -- [{texto, feito, feito_em}]
  concluido_em timestamptz,
  created_by uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (colaborador_id, tipo)
);

CREATE TABLE IF NOT EXISTS public.rh_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  avisos_ativos boolean NOT NULL DEFAULT false,
  aviso_email text,                            -- e-mail que recebe o resumo diário
  aviso_whatsapp text,                         -- WhatsApp que recebe o resumo diário
  dias_aviso_documento int NOT NULL DEFAULT 30,
  dias_aviso_ferias int NOT NULL DEFAULT 60,
  faltas_alerta_qtd int NOT NULL DEFAULT 3,    -- faltas injustificadas em ...
  faltas_alerta_dias int NOT NULL DEFAULT 90,  -- ... dias
  banco_horas_alerta_min int NOT NULL DEFAULT 2400, -- 40 h
  itens_admissao jsonb NOT NULL DEFAULT '["Documentos pessoais (RG, CPF, CTPS digital, comprovante de residência)","Exame admissional (ASO)","Contrato de trabalho assinado","Cadastro no eSocial / contabilidade","Dados bancários para pagamento","Uniforme e EPIs entregues","Equipamentos entregues (celular, notebook, ferramentas)","Acesso ao sistema criado","Apresentação à equipe e treinamento inicial"]'::jsonb,
  itens_desligamento jsonb NOT NULL DEFAULT '["Aviso prévio / comunicado de desligamento","Exame demissional (ASO)","Devolução de uniforme e EPIs","Devolução de equipamentos (celular, notebook, ferramentas, chaves)","Acesso ao sistema desativado","Acessos externos removidos (e-mail, plataformas, WhatsApp da empresa)","Rescisão enviada à contabilidade","Pagamento da rescisão","Documentos da rescisão assinados"]'::jsonb,
  ultima_execucao_em timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.rh_config (id) VALUES (1) ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS public.rh_cron_token (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  token text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.rh_cron_token (id, token)
VALUES (1, replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''))
ON CONFLICT (id) DO NOTHING;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['rh_colaboradores','rh_ausencias','rh_ferias','rh_banco_horas','rh_documentos','rh_ocorrencias','rh_checklists','rh_config']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_admin', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.rh_allowed()) WITH CHECK (public.rh_allowed())', t || '_admin', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
  END LOOP;
END $$;

ALTER TABLE public.rh_cron_token ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.rh_cron_token FROM PUBLIC, anon, authenticated;
GRANT ALL ON public.rh_cron_token TO service_role;
DROP POLICY IF EXISTS "Only active staff" ON public.rh_cron_token;
CREATE POLICY "Only active staff" ON public.rh_cron_token AS RESTRICTIVE FOR ALL TO authenticated
  USING (public.is_active_staff()) WITH CHECK (public.is_active_staff());

-- Resumo diário do RH às 08:40 de São Paulo (11:40 UTC). Só envia se avisos_ativos = true.
DO $$
BEGIN
  PERFORM cron.unschedule('rh-avisos-diarios');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
SELECT cron.schedule(
  'rh-avisos-diarios',
  '40 11 * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gestao.onlinerastreamento.com.br/api/public/hooks/rh-diario',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-rh-cron-token', (SELECT token FROM public.rh_cron_token WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $job$
);