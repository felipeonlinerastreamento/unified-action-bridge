-- Make chat-media bucket private and restrict reads to authenticated users
UPDATE storage.buckets SET public = false WHERE id = 'chat-media';

DROP POLICY IF EXISTS "Public read chat-media" ON storage.objects;

CREATE POLICY "Authenticated read chat-media"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'chat-media');