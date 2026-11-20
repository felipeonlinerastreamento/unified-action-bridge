DO $$
DECLARE p record;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies
    WHERE schemaname='public' AND permissive='PERMISSIVE'
      AND (tablename, policyname) IN (VALUES
        ('ai_assistant_files','auth read ai files'),('bot_auto_reply_log','bot_log_select'),('bot_auto_reply_rules','bot_rules_select'),('bot_auto_reply_settings','bot_settings_select'),
        ('chat_controle_links','Authenticated can delete chat controle links'),('chat_controle_links','Authenticated can insert chat controle links'),('chat_controle_links','Authenticated can update chat controle links'),('chat_controle_links','Authenticated can view chat controle links'),
        ('chat_technicians','Authenticated can delete technicians'),('chat_technicians','Authenticated can insert technicians'),('chat_technicians','Authenticated can update technicians'),('chat_technicians','Authenticated can view technicians'),
        ('company_platforms','Authenticated can manage company platforms'),('company_platforms','Authenticated can view company platforms'),
        ('company_service_templates','Authenticated can delete company service templates'),('company_service_templates','Authenticated can insert company service templates'),('company_service_templates','Authenticated can update company service templates'),('company_service_templates','Authenticated can view company service templates'),
        ('crm_opportunity_quotes','Authenticated can view quotes'),('crm_proposal_links','Authenticated read proposal links'),
        ('crm_referrals','Authenticated insert crm_referrals'),('crm_referrals','Authenticated read crm_referrals'),('crm_referrals','Authenticated update crm_referrals'),
        ('gamif_activity_checklist','gamif read all'),('gamif_metrics','gamif read all'),('gamif_process_changelog','gamif read all'),('gamif_processes','gamif read all'),('gamif_pvp_challenges','gamif read all'),('gamif_role_functions','gamif read all'),('gamif_settings','gamif read all'),('gamif_streaks','gamif read all'),('gamif_suggestion_votes','gamif read all'),('gamif_user_badges','gamif read all'),('gamif_wallets','gamif read all'),
        ('gsystem_vinculos_historico','auth read historico'),('perdidos_items','perdidos_items_select_auth'),
        ('platforms','Authenticated can manage platforms'),('platforms','Authenticated can view platforms'),('profiles','Authenticated can view profiles basic'),
        ('purchase_flow_config','purchase_flow_config_select'),('purchase_items','purchase_items_select'),('purchase_supplier_contacts','purchase_supplier_contacts_select'),('purchase_suppliers','purchase_suppliers_select'),
        ('technician_notes','technician_notes_select'),
        ('ticket_activities','Activities insert by authenticated'),('ticket_activities','Activities readable by authenticated'),('ticket_activities','Activities update by authenticated'),
        ('ticket_compra_equipamento_items','ticket_compra_equip_manage'),('ticket_compra_equipamento_items','ticket_compra_equip_select'),
        ('ticket_error_entries','ticket_error_entries_delete_auth'),('ticket_error_entries','ticket_error_entries_insert_auth'),('ticket_error_entries','ticket_error_entries_select_auth'),('ticket_error_entries','ticket_error_entries_update_auth'),
        ('ticket_perdidos_items','ticket_perdidos_items_delete_auth'),('ticket_perdidos_items','ticket_perdidos_items_insert_auth'),('ticket_perdidos_items','ticket_perdidos_items_select_auth'),('ticket_perdidos_items','ticket_perdidos_items_update_auth'),
        ('ticket_purchase_items','ticket_purchase_items_all'),('ticket_purchase_requests','ticket_purchase_requests_all'),
        ('tratativas','Autenticados podem criar tratativas'),('tratativas','Autenticados podem editar tratativas'),('tratativas','Autenticados podem ver tratativas'))
  LOOP
    IF p.qual ~ '^\(?true\)?$' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I USING (public.is_active_staff())', p.policyname, p.tablename);
    END IF;
    IF p.with_check ~ '^\(?true\)?$' THEN
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (public.is_active_staff())', p.policyname, p.tablename);
    END IF;
  END LOOP;
END $$;

ALTER POLICY "Auth users read ticket attachments" ON storage.objects USING (bucket_id = 'ticket-attachments' AND public.is_active_staff());
ALTER POLICY "Signatures authenticated read" ON storage.objects USING (bucket_id = 'user-signatures' AND public.is_active_staff());
ALTER POLICY "auth read ai-attachments" ON storage.objects USING (bucket_id = 'ai-attachments' AND public.is_active_staff());