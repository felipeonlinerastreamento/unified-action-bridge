ALTER TABLE public.message_trigger_rules
  ADD COLUMN IF NOT EXISTS block_screen boolean NOT NULL DEFAULT false;

INSERT INTO public.message_trigger_rules (
  name, is_enabled, keywords, match_type, case_sensitive, action_type,
  alert_message, alert_target_type, alert_target_sector_ids, alert_target_user_ids,
  transfer_sector_id, transfer_sector_name, transfer_note,
  sound_enabled, cooldown_minutes, priority, create_ticket, block_screen
) VALUES (
  'Menção @3136232190', true,
  '["@3136232190","3136232190","553136232190","+55 31 3623-2190","31 3623-2190","(31) 3623-2190"]'::jsonb,
  'any', false, 'floating_alert',
  'Atenção: o número 3136232190 foi mencionado em uma conversa',
  'sector', '["114d870a-000b-4134-b2cd-bb69fdb1abe6"]'::jsonb, '[]'::jsonb,
  NULL, NULL, '', true, 1, 1, false, true
);