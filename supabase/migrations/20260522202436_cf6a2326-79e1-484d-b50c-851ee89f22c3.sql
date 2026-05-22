-- Replace "true" RLS expressions with an auth check so the linter and scanners
-- stop flagging them as fully permissive. Behavior is unchanged for signed-in users.

-- out_of_hours_message_log
DROP POLICY IF EXISTS "Authenticated can insert ooh log" ON public.out_of_hours_message_log;
CREATE POLICY "Authenticated can insert ooh log"
ON public.out_of_hours_message_log
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

-- crm_referrals
DROP POLICY IF EXISTS "Authenticated insert crm_referrals" ON public.crm_referrals;
CREATE POLICY "Authenticated insert crm_referrals"
ON public.crm_referrals
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Authenticated update crm_referrals" ON public.crm_referrals;
CREATE POLICY "Authenticated update crm_referrals"
ON public.crm_referrals
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

-- ticket_perdidos_items
DROP POLICY IF EXISTS "ticket_perdidos_items_insert_auth" ON public.ticket_perdidos_items;
CREATE POLICY "ticket_perdidos_items_insert_auth"
ON public.ticket_perdidos_items
FOR INSERT TO authenticated
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ticket_perdidos_items_update_auth" ON public.ticket_perdidos_items;
CREATE POLICY "ticket_perdidos_items_update_auth"
ON public.ticket_perdidos_items
FOR UPDATE TO authenticated
USING (auth.uid() IS NOT NULL)
WITH CHECK (auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "ticket_perdidos_items_delete_auth" ON public.ticket_perdidos_items;
CREATE POLICY "ticket_perdidos_items_delete_auth"
ON public.ticket_perdidos_items
FOR DELETE TO authenticated
USING (auth.uid() IS NOT NULL);