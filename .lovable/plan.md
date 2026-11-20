# Unificar o TOP Gamific dentro do GS Hub (menu "Gamificação")

Somente o plano. Nada será alterado até sua aprovação.

## Situação atual (verificada)
- O TOP Gamific é outro sistema (React Router + banco próprio, 62 migrações, 19 funções no servidor), com login e usuários próprios.
- Hoje o GS Hub só **lê** o TOP Gamific por API externa (tela `/top-gamific`, lançamentos e missões, ligados por **nome** do usuário).
- O TOP Gamific tem cópias de GS Hub (`/gshub`, tabelas `gs_*`) e Reconnect (`/reconnect`, tabelas `rc_*`): ficam de fora.
- As regras de métricas automáticas (`auto-apply-daily-metrics`) não leem chamados: aplicam um valor fixo por dia a todos de um setor.

## 1. O que entra e o que fica de fora

**Telas de colaborador (todos os usuários)** — novas páginas em `/gamificacao/...`:
Dashboard, Rankings, Ranking de Squads, Missões, Loja, Meus Resgates, Histórico de desempenho, Métricas, Sugestões, Feed, PvP/Duelos, Perfil (conquistas, sequência), Processos (com changelog e confirmação de leitura), Assistente de IA da gamificação, Tarefas, Notificações.

**Admin (somente admin/gestor)** — `/gamificacao/admin/...`:
Usuários, Missões, Loja, Resgates, Relatórios, Métricas (inclui regras automáticas), Configurações, Notificações, AI Insights, Sugestões, Duelos, Auditoria, Configuração da IA.

**Componentes reaproveitados:** widgets de sequência, aniversário, onboarding, abas de regras automáticas, telas de processos e tarefas, relatórios. Todos convertidos para rotas TanStack, `useAuth` do GS Hub e a identidade visual do GS Hub.

**Fica de fora:** `/gshub`, `/reconnect`, tabelas `gs_*` e `rc_*`, login/reset de senha/cadastro próprios, `admin-manage-user`, `admin-reset-password`, `admin-list-emails` (usuários são gerenciados em Configurações do GS Hub), `gs-gateway`, `gs-sync-data`, `gs-send-whatsapp`, `public-api` (deixa de ser necessária), `profiles`/`user_roles`/`sectors` do TOP (usamos os do GS Hub).

**A decidir (ver item 6):** Tarefas e Assistente de IA já existem no GS Hub; Google Drive (`drive_documents`, sincronização).

## 2. Tabelas novas (prefixo `gamif_`)

| Nova tabela | Origem no TOP |
|---|---|
| gamif_wallets (saldo AtentaCoins, XP, nível por usuário) | campos de profiles do TOP |
| gamif_metric_categories, gamif_metrics | metric_categories, performance_metrics |
| gamif_entries (lançamentos) | user_performance_entries |
| gamif_daily_performance | daily_performance |
| gamif_auto_rules | auto_metric_rules |
| gamif_missions, gamif_user_missions | missions, user_missions |
| gamif_squads, gamif_squad_members | squads (ligados aos setores do GS Hub) |
| gamif_store_items, gamif_redemptions | reward_items, redemptions |
| gamif_pvp_challenges | pvp_challenges |
| gamif_suggestions, gamif_suggestion_votes | suggestions, suggestion_votes |
| gamif_badges, gamif_user_badges, gamif_streaks | badges, user_badges, user_streaks |
| gamif_notifications, gamif_user_notifications | notifications, user_notifications |
| gamif_processes, gamif_process_changelog, gamif_process_suggestions, gamif_reading_confirmations | processes e afins |
| gamif_activity_checklist, gamif_complementary_activities, gamif_role_functions | idem |
| gamif_ai_config, gamif_ai_conversations, gamif_ai_messages, gamif_ai_feedback, gamif_ai_insights | ai_* do TOP |
| gamif_settings (linha única) | platform_settings |
| gamif_audit_logs | audit_logs do TOP |
| gamif_legacy_users (mapa id antigo → usuário GS Hub, e-mail, nome) | migração |

Todas guardam o usuário como id do login do GS Hub, sem ligação direta às tabelas de login.

**Regras de acesso:**
- Colaborador: lê catálogos (missões, loja, métricas, badges, processos, rankings, feed); lê só os próprios lançamentos, resgates, notificações e conversas de IA; cria sugestões, votos, resgates, duelos e confirmações de leitura em seu nome.
- Rankings mostram nome, setor, XP e moedas de todos, via função segura que expõe só esses campos.
- Saldo e XP **nunca** são alterados pelo colaborador: só por funções seguras do banco (lançar métrica, aprovar resgate, encerrar duelo, concluir missão), que registram auditoria.
- Gestor: administra tudo da gamificação dos **setores em que está atribuído**; Admin: tudo.
- Resgate debita saldo de forma atômica (sem saldo negativo, sem resgate duplo).

## 3. Migração dos dados

1. Exportação: você abre o chat do TOP Gamific e pede a exportação em CSV de cada tabela da lista acima (este chat não pode ler o banco do outro projeto). Inclui a lista de e-mails dos usuários do TOP.
2. Mapeamento por e-mail (minúsculas, sem espaços) com `profiles.email` do GS Hub. Sai um relatório: casados, sem correspondente, duplicados.
3. Sem correspondente: entram em `gamif_legacy_users` como "pendente", com saldo e histórico preservados mas sem aparecer em rankings. Uma tela de admin permite ligar manualmente a um usuário do GS Hub depois (ou criar o usuário em Configurações e ligar).
4. Importação em ordem: catálogos → squads/setores → saldos → lançamentos → missões → loja/resgates → duelos → sugestões → notificações → processos → IA → configurações. Ids originais preservados para manter os vínculos.
5. Conferência: total de moedas e XP por usuário e contagem de linhas por tabela, TOP vs GS Hub, antes de liberar.
6. Congelamento: no dia da virada, o TOP fica só leitura; exportação final de lançamentos novos (delta) e reimportação.
7. Anexos (imagens da loja, avatares, arquivos de processos) copiados para o armazenamento do GS Hub.

## 4. Métricas automáticas com dados do GS Hub

- As regras atuais de valor fixo por setor continuam funcionando, agora num agendamento do GS Hub (1x por dia).
- Novo tipo de regra **baseada em indicador**, configurável no Admin > Métricas: escolher indicador, período, meta e moedas/XP.
- Indicadores iniciais lidos direto do banco: chamados finalizados (`service_tickets.closed_by`/responsável), chats finalizados (`zapi_chats`), tempo médio de atendimento, CSAT/NPS (`csat_responses`), tarefas concluídas (`tasks`/`task_completion_history`), termos técnicos enviados, propostas aceitas no CRM.
- Cálculo diário às 23h50 (horário de Brasília) por uma função no banco; grava o lançamento uma única vez por usuário/regra/dia (sem duplicar se rodar de novo). Operadores inativos são ignorados.
- A tela `/top-gamific` e a chamada de API externa são removidas após a virada.

## 5. Etapas sem quebrar a produção

1. **Banco**: só criar tabelas `gamif_*` e funções novas. Nenhuma tabela existente é alterada.
2. **Telas por trás de uma chave** ("Gamificação" visível só para admins enquanto em teste), menu novo no catálogo de menus e grupos de setor.
3. Telas de colaborador → telas de admin → regras automáticas → IA/processos.
4. Importação em ensaio (dados reais), conferência dos totais, correção do mapeamento.
5. Testes automáticos das regras: débito do resgate, cálculo dos indicadores, mapeamento por e-mail, permissões de colaborador x gestor x admin.
6. Teste de navegação com usuário de teste colaborador e com gestor.
7. Conferência de que chamados, chat, CRM e termos técnicos seguem iguais (nenhum arquivo deles é alterado, exceto menu/sidebar).
8. Virada: congelar TOP, importar delta, ligar menu para todos, publicar, remover `/top-gamific`.
9. Manter o TOP Gamific em só leitura por ~30 dias como cópia de segurança, depois desativar.

## 6. Riscos e decisões suas

**Riscos:** e-mails diferentes entre sistemas (saldo "órfão"); saldos divergentes se houver lançamentos durante a migração; volume de histórico grande; duplicidade de Tarefas/IA; indicadores automáticos gerarem moedas demais sem teto; aumento de uso do banco pelo cálculo diário.

**Decisões necessárias:**
1. Tarefas: usar as Tarefas já existentes do GS Hub (e migrar as do TOP para elas) ou manter Tarefas da gamificação separadas?
2. Assistente de IA: um único Assistente IA do GS Hub com conhecimento da gamificação, ou um assistente próprio dentro de Gamificação?
3. Squads: squad = setor do GS Hub, ou squads livres independentes dos setores?
4. Gestor administra a gamificação só dos seus setores ou de todos?
5. Integração Google Drive dos Processos: trazer ou descartar?
6. Quais indicadores automáticos e quanto vale cada um (moedas/XP, metas, teto diário)?
7. Usuários do TOP sem e-mail correspondente: manter pendentes para ligar manualmente (sugerido) ou descartar?
8. Data da virada e quanto tempo o TOP fica em só leitura.

## Detalhes técnicos
- Rotas em `src/routes/gamificacao.*.tsx`, admin em `src/routes/gamificacao.admin.*.tsx` com `PanelOnlyGuard`/checagem `hasRole`; dados via `ensureQueryData` + `useSuspenseQuery`; mutações sensíveis via `createServerFn` + `requireSupabaseAuth` chamando RPCs `security definer` (`gamif_apply_entry`, `gamif_redeem`, `gamif_resolve_duel`).
- Edge functions do TOP (`ai-*`, `check-birthdays`, `notify-duel-created`, `process-scheduled-notifications`, `send-notification-email`, `auto-apply-daily-metrics`) viram server functions/rotas `/api/public/*` com verificação de segredo, chamadas pelo pg_cron (1x/dia; notificações agendadas a cada 15 min, a confirmar).
- Regras puras em `src/lib/gamif-*.ts` com testes Vitest.
- Importação dos CSVs via ferramentas de inserção do banco, nunca no carregamento da página.
