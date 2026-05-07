CREATE POLICY "Authenticated can view profiles basic"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);