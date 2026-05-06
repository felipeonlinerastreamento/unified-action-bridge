
-- ============ Fix exposed sensitive data via overly permissive policies ============

-- 1. channels: tokens/webhook secrets — restrict SELECT to admin/gestor
DROP POLICY IF EXISTS "Auth users view active channels" ON public.channels;
CREATE POLICY "Admins gestors view channels" ON public.channels
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 2. audit_logs: prevent forging records as another user
DROP POLICY IF EXISTS "Auth users create audit logs" ON public.audit_logs;
CREATE POLICY "Auth users create own audit logs" ON public.audit_logs
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL AND (user_id IS NULL OR user_id = auth.uid()));

-- 3. crm_opportunities: ownership-enforced INSERT
DROP POLICY IF EXISTS "Auth users insert crm_opportunities" ON public.crm_opportunities;
CREATE POLICY "Auth users insert own crm_opportunities" ON public.crm_opportunities
  FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND (created_by IS NULL OR created_by = auth.uid())
    AND (owner_id IS NULL OR owner_id = auth.uid()
         OR public.has_role(auth.uid(), 'admin'::app_role)
         OR public.has_role(auth.uid(), 'gestor'::app_role))
  );

-- 4. csat_responses: restrict to admin/gestor or own operator rows
DROP POLICY IF EXISTS "Auth users view csat responses" ON public.csat_responses;
CREATE POLICY "Admins gestors operators view csat responses" ON public.csat_responses
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR operator_user_id = auth.uid()
  );

-- 5. csat_pending: restrict ALL to admin/gestor; operators can read their own
DROP POLICY IF EXISTS "Auth users manage csat pending" ON public.csat_pending;
CREATE POLICY "Admins gestors manage csat pending" ON public.csat_pending
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Operators view own csat pending" ON public.csat_pending
  FOR SELECT TO authenticated
  USING (operator_user_id = auth.uid());

-- 6. chat_idle_auto_message_logs: restrict reads to admin/gestor
DROP POLICY IF EXISTS "Authenticated read idle logs" ON public.chat_idle_auto_message_logs;
CREATE POLICY "Admins gestors read idle logs" ON public.chat_idle_auto_message_logs
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 7. out_of_hours_message_log: restrict reads to admin/gestor
DROP POLICY IF EXISTS "Authenticated can read ooh log" ON public.out_of_hours_message_log;
CREATE POLICY "Admins gestors read ooh log" ON public.out_of_hours_message_log
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 8. companies: restrict reads to admin/gestor (atendentes use limited views/joins)
DROP POLICY IF EXISTS "Auth users view companies" ON public.companies;
CREATE POLICY "Admins gestors view companies" ON public.companies
  FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));

-- 9. crm_contacts: restrict to admin/gestor/atendente roles only (any of the 3)
DROP POLICY IF EXISTS "Auth users view crm contacts" ON public.crm_contacts;
CREATE POLICY "Roles view crm contacts" ON public.crm_contacts
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );

-- 10. sub_clients: restrict management to admin/gestor; reads to authenticated roles
DROP POLICY IF EXISTS "Auth users manage sub clients" ON public.sub_clients;
CREATE POLICY "Admins gestors manage sub clients" ON public.sub_clients
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'gestor'::app_role));
CREATE POLICY "Roles view sub clients" ON public.sub_clients
  FOR SELECT TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'gestor'::app_role)
    OR public.has_role(auth.uid(), 'atendente'::app_role)
  );
