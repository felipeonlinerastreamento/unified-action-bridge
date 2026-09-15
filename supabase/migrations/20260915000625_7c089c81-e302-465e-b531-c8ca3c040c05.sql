CREATE TABLE public.topgamific_ai_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX idx_topgamific_ai_messages_user_created ON public.topgamific_ai_messages (user_id, created_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.topgamific_ai_messages TO authenticated;
GRANT ALL ON public.topgamific_ai_messages TO service_role;
ALTER TABLE public.topgamific_ai_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Usuario gerencia suas mensagens do assistente" ON public.topgamific_ai_messages FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);