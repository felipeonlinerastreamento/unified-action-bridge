UPDATE public.zapi_bot_flows
SET nodes = '[
  {"id": "welcome", "text": "👋 Olá {{contactName}}, bom dia.\n\nÉ um prazer atendê-lo(a) e para seguirmos com o seu atendimento, por favor, selecione uma das opções abaixo:\n\n[ 1 ] - 😉 Falar com um Atendente\n[ 2 ] - 💼 Falar com o Comercial\n[ 3 ] - 💰 Falar com o Financeiro\n[ 4 ] - ❌ Finalizar Atendimento", "type": "menu", "options": [{"key": "1", "next": "ask_info", "label": "Atendente"}, {"key": "2", "next": "msg_comercial", "label": "Comercial"}, {"key": "3", "next": "menu_financeiro", "label": "Financeiro"}, {"key": "4", "next": "end_node", "label": "Finalizar"}]},
  {"id": "ask_info", "next": "route_atendimento", "text": "Ok, agora por favor, informe:\n\n✅ *Seu Nome.*\n✅ *O assunto que você quer falar.*\n\n\nCaso já tenha informado, é só aguardar que o nosso time irá te atender em instantes🤝", "type": "message"},
  {"id": "route_atendimento", "type": "route_to_least_loaded", "target_sector": "Atendimento"},
  {"id": "msg_comercial", "next": "route_comercial", "text": "Agora é só aguardar que o nosso time irá te atender em instantes🤝", "type": "message"},
  {"id": "route_comercial", "type": "route_to_sector", "target_sector": "Comercial"},
  {"id": "menu_financeiro", "text": "💰 *Financeiro* — selecione uma opção:\n\n[ 1 ] - Falar com o Financeiro\n[ 2 ] - Segunda via de boleto", "type": "menu", "options": [{"key": "1", "next": "msg_financeiro", "label": "Falar com o Financeiro"}, {"key": "2", "next": "boleto_financeiro", "label": "Segunda via de boleto"}]},
  {"id": "msg_financeiro", "next": "route_financeiro", "text": "Agora é só aguardar que o nosso time do Financeiro irá te atender em instantes🤝", "type": "message"},
  {"id": "route_financeiro", "type": "route_to_sector", "target_sector": "Financeiro"},
  {"id": "boleto_financeiro", "type": "gsystem_boleto", "text_success": "Encontrei {{count}} boleto(s) em aberto no seu cadastro:", "text_no_boletos": "Não encontrei boletos em aberto no seu cadastro. Vou te encaminhar para o Financeiro, aguarde um instante 🤝", "fallback_sector": "Financeiro", "next_on_no_client": "ask_cpf_cnpj"},
  {"id": "ask_cpf_cnpj", "type": "ask_input", "state_key": "cpf_cnpj", "next": "boleto_por_doc", "text": "Não consegui localizar seu cadastro pelo seu número 📱.\n\nPor favor, informe seu *CPF* ou *CNPJ* (somente números) para que eu possa buscar seus boletos:"},
  {"id": "boleto_por_doc", "type": "gsystem_boleto_by_doc", "state_key": "cpf_cnpj", "text_success": "Encontrei {{count}} boleto(s) em aberto no seu cadastro:", "text_no_boletos": "Não encontrei boletos em aberto no seu cadastro. Vou te encaminhar para o Financeiro, aguarde um instante 🤝", "text_no_client": "Não consegui localizar seu cadastro com esse CPF/CNPJ. Vou te encaminhar para o Financeiro, aguarde um instante 🤝", "fallback_sector": "Financeiro"},
  {"id": "end_node", "text": "Atendimento finalizado, obrigado! 👋", "type": "end"}
]'::jsonb,
    updated_at = now()
WHERE id = 'e5e784e9-42c9-4ca5-99b8-4eccd07ab3fc';