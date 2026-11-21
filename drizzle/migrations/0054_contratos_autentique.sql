-- =====================================================================
-- Contratos: assinatura pelo Autentique (opcional, por contrato).
-- O documento vai como PDF gerado do texto congelado; o retorno chega pelo
-- webhook /api/public/hooks/autentique (ou pelo botão "Atualizar do Autentique").
-- =====================================================================
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS provedor_link text;          -- link de assinatura do contratante
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS provedor_verificacao text;    -- nenhuma | LIVE | PF_FACIAL | UPLOAD
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS provedor_sandbox boolean NOT NULL DEFAULT false;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS arquivo_assinado_url text;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS assinatura_geo text;
CREATE INDEX IF NOT EXISTS contratos_provedor_doc_idx ON public.contratos (provedor_documento_id) WHERE provedor_documento_id IS NOT NULL;
ALTER TABLE public.contratos ADD COLUMN IF NOT EXISTS provedor_signatarios jsonb NOT NULL DEFAULT '[]'::jsonb; -- [{public_id, papel, nome}]

-- Mesmas proteções do envio próprio: só o servidor grava os campos do provedor.
CREATE OR REPLACE FUNCTION public.contratos_protege_provedor()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF auth.role() = 'service_role' THEN RETURN NEW; END IF;
  IF NEW.provedor IS DISTINCT FROM OLD.provedor OR NEW.provedor_documento_id IS DISTINCT FROM OLD.provedor_documento_id
     OR NEW.provedor_link IS DISTINCT FROM OLD.provedor_link OR NEW.provedor_signatarios IS DISTINCT FROM OLD.provedor_signatarios
     OR NEW.arquivo_assinado_url IS DISTINCT FROM OLD.arquivo_assinado_url OR NEW.assinatura_geo IS DISTINCT FROM OLD.assinatura_geo THEN
    RAISE EXCEPTION 'Campos do Autentique são gravados só pelo sistema.';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS contratos_protege_provedor ON public.contratos;
CREATE TRIGGER contratos_protege_provedor BEFORE UPDATE ON public.contratos FOR EACH ROW EXECUTE FUNCTION public.contratos_protege_provedor();
