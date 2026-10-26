DROP POLICY IF EXISTS "Signatures public read" ON storage.objects;
CREATE POLICY "Signatures authenticated read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'user-signatures');