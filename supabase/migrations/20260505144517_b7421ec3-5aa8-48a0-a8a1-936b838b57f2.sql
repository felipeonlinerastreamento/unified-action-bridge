
CREATE TABLE public.crm_referrals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text DEFAULT '',
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX crm_referrals_name_unique ON public.crm_referrals (lower(name));

ALTER TABLE public.crm_referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read crm_referrals" ON public.crm_referrals FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated insert crm_referrals" ON public.crm_referrals FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Authenticated update crm_referrals" ON public.crm_referrals FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admins gestors delete crm_referrals" ON public.crm_referrals FOR DELETE TO authenticated USING (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'gestor'));

CREATE TRIGGER trg_crm_referrals_updated BEFORE UPDATE ON public.crm_referrals FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.crm_contacts ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.crm_referrals(id) ON DELETE SET NULL;
ALTER TABLE public.crm_opportunities ADD COLUMN IF NOT EXISTS referral_id uuid REFERENCES public.crm_referrals(id) ON DELETE SET NULL;
