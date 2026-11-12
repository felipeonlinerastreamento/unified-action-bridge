CREATE TABLE public.ai_assistant_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size bigint,
  mime_type text,
  description text,
  uploaded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_assistant_files TO authenticated;
GRANT ALL ON public.ai_assistant_files TO service_role;
ALTER TABLE public.ai_assistant_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth read ai files" ON public.ai_assistant_files FOR SELECT TO authenticated USING (true);
CREATE POLICY "auth insert own ai files" ON public.ai_assistant_files FOR INSERT TO authenticated WITH CHECK (uploaded_by = auth.uid());
CREATE POLICY "owner or admin update ai files" ON public.ai_assistant_files FOR UPDATE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "owner or admin delete ai files" ON public.ai_assistant_files FOR DELETE TO authenticated USING (uploaded_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

ALTER TABLE public.topgamific_ai_messages ADD COLUMN IF NOT EXISTS attachment_ids uuid[] NOT NULL DEFAULT '{}';

CREATE POLICY "auth read ai-attachments" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'ai-attachments');
CREATE POLICY "auth upload ai-attachments" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'ai-attachments' AND owner = auth.uid());
CREATE POLICY "owner delete ai-attachments" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'ai-attachments' AND (owner = auth.uid() OR public.has_role(auth.uid(),'admin')));