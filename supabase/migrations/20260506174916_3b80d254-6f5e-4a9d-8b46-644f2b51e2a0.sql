
UPDATE storage.buckets SET public = false WHERE id = 'ticket-attachments';

DROP POLICY IF EXISTS "Public read ticket attachments" ON storage.objects;

CREATE POLICY "Auth users read ticket attachments"
ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'ticket-attachments' AND auth.uid() IS NOT NULL);
