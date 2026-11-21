# Módulo Financeiro (BPO Financeiro)

## Etapa 0 — Confirmação de papéis (antes de qualquer mudança)
Admins hoje:
| Nome | E-mail | Passa a ser |
|---|---|---|
| Felipe | felipe@onlinerastreamento.com.br | continua admin + Financeiro |
| Patrícia | contato.pats@gmail.com | continua admin + Financeiro |
| Ricardo | ricardo@onlinerastreamento.com.br | gestor |
| Giseli | contato@onlinerastreamento.com.br | gestor |
| Marcus | marcus@onlinerastreamento.com.br | gestor |
| Wellington | wellington@onlinerastreamento.com.br | gestor |

A troca de papel só é feita depois da sua confirmação. Atenção: algumas telas hoje são só de admin (ex.: créditos da IA, Painel TV, certas configurações); essas quatro pessoas deixam de vê-las. Gestor continua com o resto.

## Etapa 1 — Acesso
- Lista própria `fin_acesso` (Felipe e Patrícia) e função `can_access_finance()`, usada em todas as regras das tabelas do Financeiro e no bucket de arquivos. Ser admin não basta.
- Menu "Financeiro" (ícone de carteira) aparece só para quem está na lista; não entra na liberação de menus por setor. A página também bloqueia acesso direto pelo endereço.

## Etapa 2 — Estrutura
- `fin_empresas` (inicia com OR = Online Rastreamento Ltda, CNPJ 22.632.188/0001-23; cadastrável, ex.: OT).
- `fin_categorias` com as 17 categorias pedidas, tipo, grupo do DRE e ativo.
- `fin_lancamentos` com todos os campos pedidos; `drive_file_id` único.
- `fin_contas_bancarias` e `fin_extrato_itens` (importação OFX/CSV e vínculo com lançamento).
- Bucket privado `fin-comprovantes`.
- "Vencido" é calculado na leitura (aberto + vencimento passado no fuso de São Paulo), para não depender de rotina agendada.

## Etapa 3 — Telas (em /financeiro)
Painel, Contas a pagar, Contas a receber, Comprovantes (fila "A revisar" com arquivo ao lado, Confirmar, troca rápida de categoria, upload com leitura pela IA do sistema), Fluxo de caixa (dia/semana/mês, saldo projetado), DRE (por competência, comparação com mês anterior), Conciliação (sugestão por valor + data próxima + nome, confirmar/desfazer) e Categorias. Valores em R$, datas em São Paulo.

## Etapa 4 — Ferramentas para o Claude
Adicionadas ao servidor que já existe, todas exigindo usuário na lista:
- `financeiro_categorias`, `financeiro_registrar_documento` (não duplica pelo `drive_file_id`, devolve o existente), `financeiro_documentos_registrados`.
- Endereço para conectar no Claude: **https://gestao.onlinerastreamento.com.br/mcp** (login com sua conta do sistema). Vale depois de publicar.

## Etapa 5 — Isolamento e testes
- Financeiro fica fora do sino, busca global, Assistente IA e relatórios (nenhum deles lê as tabelas fin_*; as regras do banco bloqueiam mesmo assim).
- Testes automáticos: acesso negado fora da lista, não duplicar `drive_file_id`, cálculo do DRE.

## Detalhes técnicos
- Migração: tabelas + GRANT + RLS (`can_access_finance()` SECURITY DEFINER lendo `fin_acesso`), mais a política restritiva `is_active_staff()` do projeto; `fin_acesso` sem escrita pelo app.
- Regras puras em `src/lib/finance-*.ts` (DRE, status vencido, sugestão de conciliação, parser OFX/CSV) com testes vitest.
- Server functions com `requireSupabaseAuth`; leitura de comprovante por URL assinada.
- Ferramentas MCP em `src/lib/mcp/tools/financeiro-*.ts`, usando o cliente do usuário conectado (RLS aplicada) e checagem explícita de `can_access_finance`.
- Leitura de upload pela IA via Lovable AI (modelo com visão), devolvendo campos + confiança.
