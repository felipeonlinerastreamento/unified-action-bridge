CREATE TABLE public.topgamific_entry_acks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entry_id text NOT NULL,
  acked_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, entry_id)
);

GRANT SELECT, INSERT, DELETE ON public.topgamific_entry_acks TO authenticated;
GRANT ALL ON public.topgamific_entry_acks TO service_role;

ALTER TABLE public.topgamific_entry_acks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario ve seus acks"
ON public.topgamific_entry_acks FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Usuario cria seus acks"
ON public.topgamific_entry_acks FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuario apaga seus acks"
ON public.topgamific_entry_acks FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE INDEX idx_topgamific_entry_acks_user ON public.topgamific_entry_acks (user_id);