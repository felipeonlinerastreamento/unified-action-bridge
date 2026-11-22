-- Contratos: categoria (cliente ou fornecedor), pastas (organização da lista) e a pasta
-- correspondente no Autentique. Alterações feitas só pelas ações do sistema (service role),
-- como o resto dos contratos enviados.
ALTER TABLE public.contratos
  ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'cliente',
  ADD COLUMN IF NOT EXISTS pasta text,
  ADD COLUMN IF NOT EXISTS provedor_pasta_id text;
DO $$ BEGIN
  ALTER TABLE public.contratos ADD CONSTRAINT contratos_categoria_chk CHECK (categoria IN ('cliente','fornecedor'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
CREATE INDEX IF NOT EXISTS contratos_pasta_idx ON public.contratos (pasta) WHERE pasta IS NOT NULL;
CREATE INDEX IF NOT EXISTS contratos_categoria_idx ON public.contratos (categoria);
