ALTER TABLE public.ai_assistant_config
  ADD COLUMN IF NOT EXISTS tone text NOT NULL DEFAULT 'consultivo',
  ADD COLUMN IF NOT EXISTS response_format text NOT NULL DEFAULT 'topicos',
  ADD COLUMN IF NOT EXISTS temperature numeric NOT NULL DEFAULT 0.4,
  ADD COLUMN IF NOT EXISTS forbidden_topics text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fallback_message text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS suggest_reply_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS auto_summary_enabled boolean NOT NULL DEFAULT false;

ALTER TABLE public.ai_assistant_config
  ADD CONSTRAINT ai_assistant_config_temperature_range CHECK (temperature >= 0 AND temperature <= 1);

CREATE POLICY "Gestores manage ai config"
  ON public.ai_assistant_config FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores manage ai docs"
  ON public.ai_knowledge_docs FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'gestor'))
  WITH CHECK (public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores upload ai knowledge files"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'gestor'));

CREATE POLICY "Gestores delete ai knowledge files"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'ai-knowledge' AND public.has_role(auth.uid(), 'gestor'));