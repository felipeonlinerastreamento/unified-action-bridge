ALTER TABLE public.chat_technicians ADD COLUMN IF NOT EXISTS is_city_default boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS chat_technicians_city_default_uniq
  ON public.chat_technicians (lower(btrim(city_state)))
  WHERE is_city_default AND city_state IS NOT NULL AND btrim(city_state) <> '';

CREATE TABLE IF NOT EXISTS public.technician_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  technician_id uuid NOT NULL REFERENCES public.chat_technicians(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS technician_notes_technician_idx ON public.technician_notes (technician_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.technician_notes TO authenticated;
GRANT ALL ON public.technician_notes TO service_role;

ALTER TABLE public.technician_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "technician_notes_select" ON public.technician_notes FOR SELECT TO authenticated USING (true);
CREATE POLICY "technician_notes_insert" ON public.technician_notes FOR INSERT TO authenticated WITH CHECK (auth.uid() = created_by);
CREATE POLICY "technician_notes_update" ON public.technician_notes FOR UPDATE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin')) WITH CHECK (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "technician_notes_delete" ON public.technician_notes FOR DELETE TO authenticated USING (auth.uid() = created_by OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_technician_notes_updated_at BEFORE UPDATE ON public.technician_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();