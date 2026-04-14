-- Allow all authenticated users to insert companies (for GSystem sync)
CREATE POLICY "Auth users can create companies"
ON public.companies
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- Allow all authenticated users to insert company phone links
CREATE POLICY "Auth users can create company phone links"
ON public.company_phones
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);