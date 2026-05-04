-- 1) Coluna requires_acknowledge na configuração
ALTER TABLE public.pending_reminder_settings
  ADD COLUMN IF NOT EXISTS requires_acknowledge boolean NOT NULL DEFAULT true;

-- 2) Log de exibições do popup (auto e manual)
CREATE TABLE IF NOT EXISTS public.pending_reminder_dispatch_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  trigger_type text NOT NULL DEFAULT 'auto', -- 'auto' | 'manual'
  dispatch_id uuid, -- referencia pending_reminder_dispatches quando manual
  shown_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  total_pending integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_prdl_user ON public.pending_reminder_dispatch_log(user_id);
CREATE INDEX IF NOT EXISTS idx_prdl_shown_at ON public.pending_reminder_dispatch_log(shown_at DESC);
CREATE INDEX IF NOT EXISTS idx_prdl_dispatch ON public.pending_reminder_dispatch_log(dispatch_id);

ALTER TABLE public.pending_reminder_dispatch_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Auth users insert own dispatch log"
  ON public.pending_reminder_dispatch_log FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own dispatch log"
  ON public.pending_reminder_dispatch_log FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Auth users view own dispatch log"
  ON public.pending_reminder_dispatch_log FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins gestors view all dispatch log"
  ON public.pending_reminder_dispatch_log FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

-- 3) Disparos manuais — escutados via realtime
CREATE TABLE IF NOT EXISTS public.pending_reminder_dispatches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  target_type text NOT NULL DEFAULT 'all', -- 'all' | 'sector' | 'users'
  target_sector_ids uuid[] NOT NULL DEFAULT '{}',
  target_user_ids uuid[] NOT NULL DEFAULT '{}',
  note text NOT NULL DEFAULT ''
);

CREATE INDEX IF NOT EXISTS idx_prd_created_at ON public.pending_reminder_dispatches(created_at DESC);

ALTER TABLE public.pending_reminder_dispatches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins gestors manage dispatches"
  ON public.pending_reminder_dispatches FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'gestor'::app_role));

CREATE POLICY "Auth users view dispatches"
  ON public.pending_reminder_dispatches FOR SELECT TO authenticated
  USING (auth.uid() IS NOT NULL);

ALTER PUBLICATION supabase_realtime ADD TABLE public.pending_reminder_dispatches;
ALTER TABLE public.pending_reminder_dispatches REPLICA IDENTITY FULL;