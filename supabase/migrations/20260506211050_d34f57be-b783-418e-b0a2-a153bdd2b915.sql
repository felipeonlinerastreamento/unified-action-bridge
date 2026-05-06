INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-media', 'chat-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS "Public read chat-media" ON storage.objects;
CREATE POLICY "Public read chat-media"
ON storage.objects FOR SELECT
USING (bucket_id = 'chat-media');