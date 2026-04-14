-- AI Assistant configuration table
CREATE TABLE public.ai_assistant_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  system_prompt text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

ALTER TABLE public.ai_assistant_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read ai config"
  ON public.ai_assistant_config FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage ai config"
  ON public.ai_assistant_config FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Insert default config row
INSERT INTO public.ai_assistant_config (system_prompt) VALUES (
  'Você é um assistente comercial especializado. Seu papel é ajudar operadores de atendimento a conduzir conversas de forma eficiente e profissional. Baseie suas sugestões no histórico de atendimentos anteriores do cliente, tempo de atendimento e contexto da conversa atual. Seja objetivo e direto nas sugestões.'
);

-- AI Knowledge documents metadata
CREATE TABLE public.ai_knowledge_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer DEFAULT 0,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.ai_knowledge_docs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users read ai docs"
  ON public.ai_knowledge_docs FOR SELECT
  USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins manage ai docs"
  ON public.ai_knowledge_docs FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Storage bucket for knowledge documents
INSERT INTO storage.buckets (id, name, public) VALUES ('ai-knowledge', 'ai-knowledge', false);

CREATE POLICY "Auth users read ai knowledge files"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'ai-knowledge' AND auth.uid() IS NOT NULL);

CREATE POLICY "Admins upload ai knowledge files"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins delete ai knowledge files"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'admin'));