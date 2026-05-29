CREATE TABLE public.tratativas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  categoria TEXT NOT NULL CHECK (categoria IN ('telemetria','fadiga')),
  numero_ocorrencia TEXT NOT NULL,
  situacao TEXT,
  cliente TEXT,
  identificador TEXT,
  imei TEXT,
  tipo TEXT,
  responsavel_email TEXT,
  data_tratativa TIMESTAMPTZ,
  primeiro_alarme TIMESTAMPTZ,
  ultimo_alarme TIMESTAMPTZ,
  motorista_nome TEXT,
  motorista_situacao TEXT,
  motorista_observacoes TEXT,
  alarmes JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.tratativas TO authenticated;
GRANT ALL ON public.tratativas TO service_role;

ALTER TABLE public.tratativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver tratativas"
  ON public.tratativas FOR SELECT TO authenticated USING (true);

CREATE POLICY "Autenticados podem criar tratativas"
  ON public.tratativas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Autenticados podem editar tratativas"
  ON public.tratativas FOR UPDATE TO authenticated USING (true);

CREATE POLICY "Admin/Gestor podem excluir tratativas"
  ON public.tratativas FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER tratativas_set_updated_at
  BEFORE UPDATE ON public.tratativas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX idx_tratativas_categoria ON public.tratativas(categoria);
CREATE INDEX idx_tratativas_created_at ON public.tratativas(created_at DESC);