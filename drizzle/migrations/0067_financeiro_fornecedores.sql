-- lovable-cron-fallback-reviewed: leitura da caixa financeiro@ a cada 30 min definida pelo usuário no arquivo do repositório
-- =====================================================================
-- Financeiro › Fornecedores: cadastro com a regra de cobrança, conferência automática das
-- faturas, aprovação para pagamento, evidências de alteração de valores, leitura da caixa
-- financeiro@ (cobranças e notas por e-mail) e importação do DDA do banco.
-- Acesso: só quem está no Financeiro (can_access_finance), como o resto dos fin_*.
-- =====================================================================

ALTER TABLE public.fin_lancamentos DROP CONSTRAINT IF EXISTS fin_lancamentos_origem_check;
ALTER TABLE public.fin_lancamentos ADD CONSTRAINT fin_lancamentos_origem_check
  CHECK (origem IN ('drive', 'upload', 'manual', 'importacao', 'gsystem', 'email', 'dda'));

CREATE TABLE IF NOT EXISTS public.fin_fornecedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  nome text NOT NULL,
  documento text UNIQUE,                         -- CNPJ/CPF só números
  emails text[] NOT NULL DEFAULT '{}',           -- remetentes ou domínios (@empresa.com.br) das cobranças
  categoria_id uuid REFERENCES public.fin_categorias(id) ON DELETE SET NULL,
  empresa_id uuid REFERENCES public.fin_empresas(id) ON DELETE SET NULL,
  regras jsonb NOT NULL DEFAULT '[]'::jsonb,     -- componentes da cobrança (fixo, por veículo, por chip, por serviço)
  competencia_ref text NOT NULL DEFAULT 'anterior' CHECK (competencia_ref IN ('anterior','atual')),
  tolerancia_pct numeric(6,2) NOT NULL DEFAULT 2,
  explicacao text,                               -- como o fornecedor cobra (texto livre)
  dia_vencimento int CHECK (dia_vencimento IS NULL OR dia_vencimento BETWEEN 1 AND 31),
  exige_aprovacao boolean NOT NULL DEFAULT true,
  ativo boolean NOT NULL DEFAULT true,
  created_by uuid DEFAULT auth.uid(),
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.fin_lancamentos
  ADD COLUMN IF NOT EXISTS fornecedor_id uuid REFERENCES public.fin_fornecedores(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS valor_esperado numeric(14,2),
  ADD COLUMN IF NOT EXISTS conferencia jsonb,                      -- memória de cálculo da cobrança esperada
  ADD COLUMN IF NOT EXISTS aprovacao text CHECK (aprovacao IS NULL OR aprovacao IN ('pendente','aprovado','reprovado')),
  ADD COLUMN IF NOT EXISTS aprovado_por uuid,
  ADD COLUMN IF NOT EXISTS aprovado_em timestamptz,
  ADD COLUMN IF NOT EXISTS aprovacao_obs text,
  ADD COLUMN IF NOT EXISTS email_message_id text,
  ADD COLUMN IF NOT EXISTS dda_chave text,
  ADD COLUMN IF NOT EXISTS nota_chave text;
CREATE UNIQUE INDEX IF NOT EXISTS fin_lancamentos_dda_uq ON public.fin_lancamentos (dda_chave) WHERE dda_chave IS NOT NULL;
CREATE INDEX IF NOT EXISTS fin_lancamentos_fornecedor_idx ON public.fin_lancamentos (fornecedor_id);
CREATE INDEX IF NOT EXISTS fin_lancamentos_aprovacao_idx ON public.fin_lancamentos (aprovacao) WHERE aprovacao = 'pendente';

-- Evidências (trilha de auditoria): regra alterada, valor diferente do esperado, aumento em relação
-- às cobranças anteriores, boleto do e-mail que não está no DDA, boleto do DDA sem cobrança, aprovações.
CREATE TABLE IF NOT EXISTS public.fin_evidencias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid REFERENCES public.fin_fornecedores(id) ON DELETE SET NULL,
  lancamento_id uuid REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  tipo text NOT NULL CHECK (tipo IN ('regra_alterada','valor_divergente','aumento_valor','boleto_fora_dda','dda_sem_cobranca','aprovacao','pagamento')),
  titulo text NOT NULL,
  descricao text,
  dados jsonb NOT NULL DEFAULT '{}'::jsonb,
  user_id uuid DEFAULT auth.uid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_evidencias_forn_idx ON public.fin_evidencias (fornecedor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS fin_evidencias_lanc_idx ON public.fin_evidencias (lancamento_id);

-- Toda mudança na regra de cobrança de um fornecedor vira evidência (antes × depois, quem e quando).
CREATE OR REPLACE FUNCTION public.fin_fornecedor_evidencia()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.regras IS DISTINCT FROM OLD.regras OR NEW.tolerancia_pct IS DISTINCT FROM OLD.tolerancia_pct
     OR NEW.competencia_ref IS DISTINCT FROM OLD.competencia_ref THEN
    INSERT INTO public.fin_evidencias (fornecedor_id, tipo, titulo, descricao, dados, user_id)
    VALUES (NEW.id, 'regra_alterada', 'Regra de cobrança alterada', NEW.nome,
      jsonb_build_object('antes', jsonb_build_object('regras', OLD.regras, 'tolerancia_pct', OLD.tolerancia_pct, 'competencia_ref', OLD.competencia_ref),
                         'depois', jsonb_build_object('regras', NEW.regras, 'tolerancia_pct', NEW.tolerancia_pct, 'competencia_ref', NEW.competencia_ref)),
      auth.uid());
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fin_fornecedor_evidencia ON public.fin_fornecedores;
CREATE TRIGGER fin_fornecedor_evidencia BEFORE UPDATE ON public.fin_fornecedores FOR EACH ROW EXECUTE FUNCTION public.fin_fornecedor_evidencia();

-- Evidência não se apaga nem se altera pelo app (só leitura e inclusão). A única mudança aceita é
-- perder o vínculo (lançamento ou fornecedor excluído): a evidência continua guardada.
CREATE OR REPLACE FUNCTION public.fin_evidencia_imutavel()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'UPDATE'
     AND NEW.tipo = OLD.tipo AND NEW.titulo = OLD.titulo AND NEW.descricao IS NOT DISTINCT FROM OLD.descricao
     AND NEW.dados = OLD.dados AND NEW.created_at = OLD.created_at AND NEW.user_id IS NOT DISTINCT FROM OLD.user_id
     AND (NEW.lancamento_id IS NOT DISTINCT FROM OLD.lancamento_id OR NEW.lancamento_id IS NULL)
     AND (NEW.fornecedor_id IS NOT DISTINCT FROM OLD.fornecedor_id OR NEW.fornecedor_id IS NULL) THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Evidências não podem ser alteradas ou apagadas.';
END $$;
DROP TRIGGER IF EXISTS fin_evidencia_imutavel ON public.fin_evidencias;
CREATE TRIGGER fin_evidencia_imutavel BEFORE UPDATE OR DELETE ON public.fin_evidencias FOR EACH ROW EXECUTE FUNCTION public.fin_evidencia_imutavel();

-- Caixa de e-mail do financeiro (uma linha) e o registro de cada e-mail lido.
CREATE TABLE IF NOT EXISTS public.fin_email_config (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  ativo boolean NOT NULL DEFAULT false,
  mailbox text NOT NULL DEFAULT 'financeiro@onlinerastreamento.com.br',
  connection_key text NOT NULL DEFAULT 'MICROSOFT_OUTLOOK_API_KEY',
  ler_desde timestamptz NOT NULL DEFAULT (now() - interval '30 days'),
  ultima_leitura_em timestamptz,
  ultimo_resumo jsonb,
  updated_by uuid,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.fin_email_config (id) VALUES (1) ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.fin_email_mensagens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id text NOT NULL UNIQUE,
  remetente text,
  assunto text,
  recebido_em timestamptz,
  status text NOT NULL CHECK (status IN ('lancado','ignorado','duplicado','erro')),
  anexos int NOT NULL DEFAULT 0,
  lancamento_id uuid REFERENCES public.fin_lancamentos(id) ON DELETE SET NULL,
  motivo text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS fin_email_mensagens_data_idx ON public.fin_email_mensagens (recebido_em DESC);

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['fin_fornecedores','fin_evidencias','fin_email_config','fin_email_mensagens']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_all', t);
    EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (public.can_access_finance()) WITH CHECK (public.can_access_finance())', t || '_all', t);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', 'Only active staff', t);
    EXECUTE format('CREATE POLICY %I ON public.%I AS RESTRICTIVE FOR ALL TO authenticated USING (public.is_active_staff()) WITH CHECK (public.is_active_staff())', 'Only active staff', t);
  END LOOP;
END $$;

-- Leitura da caixa financeiro@ a cada 30 minutos (usa o mesmo token do agendador do Financeiro).
DO $$
BEGIN
  PERFORM cron.unschedule('financeiro-email');
EXCEPTION WHEN OTHERS THEN
  NULL;
END $$;
SELECT cron.schedule(
  'financeiro-email',
  '7,37 * * * *',
  $job$
  SELECT net.http_post(
    url := 'https://gestao.onlinerastreamento.com.br/api/public/hooks/financeiro-email',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-fin-cron-token', (SELECT token FROM public.fin_cron_token WHERE id = 1)
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $job$
);