CREATE TABLE public.geocode_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  address_key text NOT NULL UNIQUE,
  address text NOT NULL,
  lat double precision,
  lng double precision,
  not_found boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.geocode_cache TO authenticated;
GRANT ALL ON public.geocode_cache TO service_role;

ALTER TABLE public.geocode_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can read geocode cache"
  ON public.geocode_cache FOR SELECT TO authenticated USING (true);

CREATE POLICY "Authenticated can insert geocode cache"
  ON public.geocode_cache FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "Authenticated can update geocode cache"
  ON public.geocode_cache FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
