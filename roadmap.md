# Serviços técnicos com termo de aceite

- [x] Catálogo próprio de categorias (Config > Encaminhamento), sincronizado com GSystem, com categoria "Serviço Técnico".
- [x] Telas de chamado/chat leem as categorias do nosso catálogo.
- [x] Termos técnicos: tabela, parâmetros por tipo (Instalação/Manutenção/Retirada) e checklists.
- [x] Página pública do termo com CPF, aceite e recusa.
- [x] Aba CRM > Serviços Técnicos com filtros Pendentes/Aceitos/Recusados/Enviadas e envio para agendamento.
- [x] Bloqueios: Agenda sem termo aceito (exceto admin/gestor) e finalização de chamado sem termo enviado.
- [x] Testes das regras, verificação.

# Gamificação (unificação do TOP Gamific)

- [x] Banco: tabelas da gamificação, regras de acesso, resgate atômico, ligação de usuários pendentes, regra automática diária 23h50.
- [x] Menu "Gamificação" só para admins até liberação.
- [x] Telas: Dashboard, Rankings (individual/squads), Missões, Loja + Meus resgates, Histórico, Sugestões.
- [x] Admin: lançamentos, métricas, regras automáticas, missões, loja, resgates, sugestões, usuários pendentes.
- [x] Dashboard em branco: carregamento espera login e papéis (sem tela vazia).
- [x] Telas restantes: Feed, Duelos, Perfil, Processos, Notificações, Métricas; Admin: relatórios, notificações, duelos, conquistas, análises da IA, auditoria, configurações.
- [x] Importação dos dados do TOP via /export (ids originais, idempotente, tarefas nas Tarefas do GS Hub, ADM = Administrativo) + relatório.
- [x] Pessoas pendentes ligadas/excluídas e importação repetida.
- [x] Virada: importação desativada (função insegura removida), regra automática do Atendimento ligada, menu liberado para todos, /top-gamific removida, verificação de segurança.

# Desempenho (itens 1 a 4 da auditoria)

- [x] Índices: última mensagem por conversa (com/sem notas internas), status por id da mensagem, telefone (trigram), comentários e logs por data.
- [x] Polling global: pausa em segundo plano, contadores do menu em uma consulta a cada 60s, sem getUser repetido; realtime mantido.
- [x] Central: direção da última mensagem gravada na conversa (trigger + backfill); lista sem ler mensagens.
- [x] Limpeza de históricos técnicos + rotina diária de retenção (7/90 dias).
- [x] Medições antes x depois.

# Termos de serviço técnico — gestão completa (Config > CRM)

- [x] Criar novos tipos de termo (título, texto, checklist próprios).
- [x] Editar qualquer termo.
- [x] Excluir com confirmação; se já usado, apenas inativar.
- [x] Mensagens de envio por termo (WhatsApp/e-mail) com variáveis e pré-visualização.
- [x] Novos tipos no formulário do termo (chat/chamado) e em "Exige termo" (Encaminhamento).
- [x] Termos já enviados não mudam.

- [x] Ciclo do serviço técnico (termo no chat, A resolver, recusa, 8h, solicitação com protocolo, testes vinculados)
