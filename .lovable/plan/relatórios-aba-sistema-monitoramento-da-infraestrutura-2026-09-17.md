# Relatórios → aba "Sistema" (monitoramento da infraestrutura)

Nova aba dentro de Relatórios, visível apenas para Admin e Gestor, mostrando em uma tela só como está a saúde do sistema, das integrações e das rotinas automáticas — com alerta no sino quando algo sai do normal.

## O que a tela mostra

**1. Disponibilidade e desempenho do banco de dados**
- Tamanho total dos dados (hoje 913 MB) e crescimento nos últimos 7 dias.
- Conexões em uso vs. limite (hoje 67 de 240) com barra colorida.
- Eficiência de memória (quanto o banco atende direto da memória em vez do disco) — é o indicador prático de consumo de memória disponível.
- Travamentos entre operações, transações desfeitas e arquivos temporários, com leitura em linguagem simples.
- Tempo desde o último reinício do banco.

**2. Rotinas automáticas (robô, e-mails, chat parado, CRM, sincronizações)**
- Lista das 7 rotinas com última execução, resultado e duração.
- Falhas nas últimas 24 h e alerta quando uma rotina não roda há mais tempo do que deveria.

**3. Integrações externas**
- Z-API (WhatsApp), GSystem, Seu Instalador, Top Gamific, Google Drive e as caixas de e-mail Microsoft.
- Cada uma com resposta ok/lenta/falha, tempo de resposta e último erro. As verificações são leves (uma consulta de leitura por serviço) e ficam em cache por 1 minuto.
- Caixas de e-mail mostram a última verificação e o erro atual (hoje suporte@ e comercial@ estão sem conta própria conectada).

**4. Gargalos**
- Consultas mais lentas do banco (top 10 por tempo médio).
- Tabelas que mais crescem.
- Fila de trabalho acumulada: mensagens do robô pendentes, e-mails não processados, atendimentos abertos há muito tempo.

**5. Falhas recentes**
- Registro de erros das integrações nas últimas 24 h / 7 dias, agrupado por serviço, com detalhe ao clicar.

Cabeçalho com 4 cartões de resumo (Banco, Rotinas, Integrações, Falhas), cada um verde/amarelo/vermelho, botão "Atualizar agora", atualização automática a cada 60 s e exportação em CSV/PDF junto com os demais relatórios.

## Alertas para Admin e Gestor

Uma verificação a cada 5 minutos gera notificação no sino (e o aviso na tela que o sistema já usa) quando:
- uso de conexões acima de 80% do limite;
- eficiência de memória abaixo de 95%;
- crescimento do banco acima do limite configurado (padrão 2 GB);
- qualquer rotina automática falhando ou parada há mais de 15 minutos;
- integração fora do ar em duas verificações seguidas;
- mais de 10 falhas de integração na última hora.

Cada alerta é enviado uma vez enquanto o problema durar (e um aviso de "normalizado" quando voltar). Os limites ficam editáveis em Configurações.

## Análise FMEA (riscos do próprio monitoramento)

| # | Falha possível | Efeito | Causa | Prevenção adotada |
|---|---|---|---|---|
| 1 | Tela expõe dados internos do servidor a operador | Vazamento de informação | Falta de restrição | Aba só para Admin/Gestor, verificação no servidor, não só na tela |
| 2 | Verificar integrações a cada abertura sobrecarrega serviços externos | Bloqueio por excesso de chamadas | Sem cache | Cache de 60 s por serviço e verificações somente de leitura |
| 3 | Consulta pesada de estatísticas trava o banco | Sistema lento | Consultas sem limite | Consultas com limite e tempo máximo; leituras de catálogo, não de tabelas grandes |
| 4 | Alerta repetido a cada 5 min vira spam | Equipe ignora avisos | Sem controle de repetição | Um alerta por problema enquanto durar, mais aviso de normalização |
| 5 | Falha do próprio monitor passa despercebida | Falsa sensação de tudo certo | Erro silencioso | Cada bloco mostra "não foi possível verificar" em vez de zero |
| 6 | Indicador sem referência (ex.: 913 MB) confunde | Decisão errada | Falta de limite conhecido | Comparação com limite configurável e com a semana anterior |
| 7 | Verificação de integração usa credencial errada | Falso alarme de queda | Chave ausente | Distinguir "não configurado" de "fora do ar" |
| 8 | Alerta dispara em manutenção programada | Ruído | Sem pausa | Botão "silenciar alertas por 1 h" |
| 9 | Rotina de alerta só roda no site publicado | Alerta não chega | Dependência de publicação | Aviso na tela quando a rotina não roda há mais de 15 min |
| 10 | Exportação de PDF pesada trava o navegador | Tela congela | Muitos dados | Exportação limitada ao período visível |

## Detalhes técnicos

- Migration com funções `SECURITY DEFINER` (`public.sys_db_health()`, `sys_slow_queries()`, `sys_table_growth()`, `sys_cron_runs()`) lendo `pg_stat_database`, `pg_stat_activity`, `pg_settings`, `pg_statio`, `pg_stat_statements` (se disponível), `pg_class` e `cron.job` / `cron.job_run_details`; `EXECUTE` concedido a `authenticated` e cada função valida `has_role(auth.uid(),'admin' | 'gestor')`.
- Tabela `system_health_settings` (limites e silenciamento) e `system_health_alert_log` (controle de repetição), com RLS e GRANTs.
- `src/lib/system-health.server.ts`: coleta do banco, cron, filas e pings de integração com cache em memória de 60 s; `src/lib/system-health.functions.ts` com `requireSupabaseAuth` + checagem de papel.
- `src/routes/api.public.system-health-scan.tsx` protegido por `CRON_SECRET`, agendado a cada 5 min, gravando notificações em `notifications` para Admin/Gestor.
- `src/components/relatorios/system-health-tab.tsx` + nova `TabsTrigger` em `src/routes/relatorios.tsx` (renderizada só para Admin/Gestor), usando os componentes de cartão/gráfico já existentes.
- Sem alteração nas telas e rotinas atuais.
