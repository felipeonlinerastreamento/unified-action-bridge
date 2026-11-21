-- Regras de acesso do bucket privado "fin-comprovantes" (Financeiro).
-- Pré-requisito: o bucket "fin-comprovantes" (privado) criado pela plataforma.
-- Só quem está em fin_acesso (can_access_finance) lê, envia ou apaga arquivos.
DROP POLICY IF EXISTS "fin_comprovantes_select" ON storage.objects;
CREATE POLICY "fin_comprovantes_select" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'fin-comprovantes' AND public.can_access_finance());
DROP POLICY IF EXISTS "fin_comprovantes_insert" ON storage.objects;
CREATE POLICY "fin_comprovantes_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'fin-comprovantes' AND public.can_access_finance());
DROP POLICY IF EXISTS "fin_comprovantes_delete" ON storage.objects;
CREATE POLICY "fin_comprovantes_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'fin-comprovantes' AND public.can_access_finance());
