DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND permissive='PERMISSIVE'
      AND (tablename, policyname) IN (VALUES
        ('ticket_reminders','Auth users create ticket reminders'),('ticket_reminders','Auth users update ticket reminders'),('ticket_reminders','Auth users view ticket reminders'),
        ('email_channels','Atendentes podem ver canais de email ativos'),
        ('notifications','Auth users insert notifications'),
        ('attendance_flow_instances','Auth users manage flow instances'),
        ('sub_clients','Auth users view sub clients'),
        ('attendance_event_logs','Auth users insert event logs'),('attendance_event_logs','Auth users view event logs'),
        ('okr_checkins','Auth users insert checkins'),('okr_checkins','Auth users view checkins'),
        ('notification_campaigns','Auth users view campaigns'),
        ('ticket_liberacao_items','Auth users delete ticket liberacao items'),('ticket_liberacao_items','Auth users insert ticket liberacao items'),('ticket_liberacao_items','Auth users update ticket liberacao items'),('ticket_liberacao_items','Auth users view ticket liberacao items'),
        ('zapi_quick_replies','Auth users insert quick replies'),('zapi_quick_replies','Auth users view quick replies'),
        ('message_trigger_rules','Auth users view trigger rules'),
        ('ticket_agents','Auth users create ticket agents'),('ticket_agents','Auth users delete ticket agents'),('ticket_agents','Auth users view ticket agents'),
        ('user_gsystem_links','Auth users view gsystem links'),
        ('daily_motivational_quotes','Auth users insert daily quotes'),('daily_motivational_quotes','Auth users view daily quotes'),
        ('okr_cycles','Auth users view okr cycles'),
        ('ticket_perdidos_items','ticket_perdidos_items_delete_auth'),('ticket_perdidos_items','ticket_perdidos_items_insert_auth'),('ticket_perdidos_items','ticket_perdidos_items_update_auth'),
        ('ticket_suprimento_items','Auth users manage ticket suprimento items'),('ticket_suprimento_items','Auth users view ticket suprimento items'),
        ('company_observations','Auth users view observations'),
        ('ticket_comments','Auth users create ticket comments'),('ticket_comments','Auth users view ticket comments'),
        ('inventory_movements','Auth users view movements'),
        ('okr_objectives','Auth users view objectives'),
        ('ai_usage_logs','Auth users insert ai usage logs'),
        ('crm_recurring_contacts','Auth users view crm_recurring_contacts'),
        ('zapi_chats','Auth users insert zapi chats'),('zapi_chats','Auth users update zapi chats'),('zapi_chats','Auth users view zapi chats'),
        ('zapi_messages','Auth users insert zapi messages'),('zapi_messages','Auth users update zapi messages'),('zapi_messages','Auth users view zapi messages'),
        ('crm_referrals','Authenticated insert crm_referrals'),('crm_referrals','Authenticated update crm_referrals'),
        ('ticket_error_entries','ticket_error_entries_delete_auth'),('ticket_error_entries','ticket_error_entries_insert_auth'),('ticket_error_entries','ticket_error_entries_update_auth'),
        ('user_sector_assignments','Auth users view user sector assignments'),
        ('pending_reminder_dispatches','Auth users view dispatches'),
        ('company_shared_notes','Auth users insert shared notes'),('company_shared_notes','Auth users update shared notes'),('company_shared_notes','Auth users view shared notes'),
        ('ticket_tracking','Auth users delete tracking'),('ticket_tracking','Auth users insert tracking'),('ticket_tracking','Auth users update tracking'),('ticket_tracking','Auth users view tracking'),
        ('attendance_flow_history','Auth users manage flow history'),
        ('service_tickets','Auth users create tickets'),('service_tickets','Auth users update tickets'),('service_tickets','Auth users view tickets'),
        ('tratativas','Autenticados podem criar tratativas'),
        ('business_hours_settings','Authenticated can read business hours'),
        ('equipment_kit_items','auth read kit'),
        ('accessory_catalog','auth read accessories'),
        ('technical_term_settings','Authenticated read technical term settings'),
        ('crm_opportunity_types','Authenticated can manage opp types'),('crm_opportunity_types','Authenticated can view opp types'),
        ('ticket_assignment_alert_settings','read settings'),
        ('geocode_cache','Authenticated can insert geocode cache'),('geocode_cache','Authenticated can read geocode cache'),('geocode_cache','Authenticated can update geocode cache'),
        ('crm_proposal_settings','Authenticated read proposal settings'),
        ('crm_service_catalog','Authenticated can view services'),
        ('ticket_subcategory_equipment_models','Authenticated can read subcategory equipment models'),
        ('gamif_badges','gamif read all'),('gamif_suggestions','gamif read all'),
        ('ticket_categories','Authenticated read ticket categories'),
        ('chat_tag_catalog','Authenticated can read tag catalog'),
        ('ticket_activity_catalog','Catalog readable by authenticated'),
        ('compra_equipamento_items','compra_equip_catalog_select'),
        ('chat_idle_auto_messages','Authenticated read idle auto messages'),
        ('technical_term_types','Authenticated read technical term types'),
        ('ticket_subcategories','Authenticated can view subcategories'))
  LOOP
    IF p.qual ~ '^\(?(true|auth\.uid\(\) IS NOT NULL)\)?$' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (public.is_active_staff())', p.policyname, p.tablename);
    END IF;
    IF p.with_check ~ '^\(?(true|auth\.uid\(\) IS NOT NULL)\)?$' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (public.is_active_staff())', p.policyname, p.tablename);
    END IF;
  END LOOP;
END $$;

ALTER POLICY "Auth users read ai knowledge files" ON storage.objects USING (bucket_id = 'ai-knowledge' AND public.is_active_staff());
ALTER POLICY "Auth users upload ticket attachments" ON storage.objects WITH CHECK (bucket_id = 'ticket-attachments' AND public.is_active_staff());
ALTER POLICY "Auth users delete own ticket attachments" ON storage.objects USING (bucket_id = 'ticket-attachments' AND public.is_active_staff());