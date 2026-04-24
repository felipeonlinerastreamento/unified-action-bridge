UPDATE public.zapi_bot_flows
SET nodes = jsonb_set(nodes, '{0,options,0,next}', '"ask_info"'::jsonb),
    updated_at = now()
WHERE id = 'e5e784e9-42c9-4ca5-99b8-4eccd07ab3fc'
  AND nodes->0->'options'->0->>'key' = '1';

-- Reset chat state for the affected number so it goes through the bot again
UPDATE public.zapi_chats
SET status = 'aguardando',
    bot_state = '{}'::jsonb,
    sector_name = NULL,
    assigned_to = NULL
WHERE phone = '553188944990';