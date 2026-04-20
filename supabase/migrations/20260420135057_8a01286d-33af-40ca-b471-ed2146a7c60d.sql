CREATE TABLE public.company_observations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  created_by UUID,
  author_name TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE INDEX idx_company_observations_company_id ON public.company_observations(company_id, created_at DESC);

ALTER TABLE public.company_observations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users view observations"
ON public.company_observations
FOR SELECT
TO authenticated
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Auth users insert own observations"
ON public.company_observations
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = created_by);