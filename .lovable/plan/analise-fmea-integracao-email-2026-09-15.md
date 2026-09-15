# Análise FMEA — Integração de E-mail (Office 365) → Atendimentos automáticos

**Data:** 2026-09-15

**Escopo analisado:** `src/lib/outlook.server.ts`, `src/lib/email-poll.server.ts`, `src/lib/email-channels.functions.ts`, `src/routes/api.public.email-poll.tsx`, `src/components/configuracoes/email-channels-config.tsx`, `src/routes/configuracoes.canais-email.tsx`.

**Natureza deste documento:** análise. Nenhum código de produção foi alterado por esta análise.

---

## 1. Objetivo

Identificar os modos de falha do fluxo "novo e-mail recebido no Outlook → abertura automática de atendimento", avaliar Severidade (S), Ocorrência (O) e Detecção (D), calcular o RPN (S × O × D) e priorizar as ações de mitigação.

Isso inclui tanto o fluxo de ingestão quanto a atualização recente (server function `triggerEmailPoll`, painel de caixas em Integrações e ajuste da mensagem de status da conexão Outlook).

---

## 2. Como o fluxo funciona hoje (base da análise)

1. O admin/gestor cadastra as caixas em **Configurações > Integrações** ou **Configurações > Canais de E-mail** (`email_channels`, via `listEmailChannels` / `upsertEmailChannel` / `deleteEmailChannel`).
2. O polling é disparado de duas formas:
   - botão "verificar agora" no painel → server function `triggerEmailPoll` (exige papel admin/gestor);
   - agendador externo → `POST` ou `GET` em `/api/public/email-poll`, autorizado por `CRON_SECRET` (`isAuthorizedCronRequest`).
3. `pollEmailChannel(channelId)`:
   - valida `is_active` e `polling_enabled`;
   - chama `listUnreadMessages(25)` (Graph, `$filter=isRead eq false`, `$orderby=receivedDateTime asc`);
   - por mensagem: aplica `ignore_domains` / `ignore_emails`; checa duplicidade em `email_processed`; procura empresa em `crm_contacts` pelo e-mail do remetente; cria o atendimento em `service_tickets` com `attendance_id` no formato `EM-<ts>-<rand>`; grava em `email_processed`; marca a mensagem como lida (`markMessageAsRead`).
   - no fim, atualiza `last_polled_at`, `last_poll_status` (`ok` / `partial` / `error`) e `last_poll_error` (até 3 erros).
4. `pollAllActiveEmailChannels()` percorre todos os canais ativos, um a um.
5. A conexão é exibida por `checkOutlookConnection` → `getOutlookProfile()`, que usa o conector Microsoft Outlook via gateway (`LOVABLE_API_KEY` + `MICROSOFT_OUTLOOK_API_KEY`, OAuth/token, sem usuário e senha).

---

## 3. Metodologia

Escalas de 1 a 10. RPN = S × O × D. Faixas de prioridade: **P1** (RPN ≥ 300), **P2** (150–299), **P3** (< 150).

---

## 4. Tabela FMEA — A. Entrada (leitura dos e-mails)

| ID | Modo de falha | Efeito | S | Causa | O | Controle atual | D | RPN | Ação recomendada |
|----|---------------|--------|---|-------|---|----------------|---|-----|------------------|
| A1 | E-mail da conta conectada é lido por **todos** os canais | Mesmo e-mail gera 1 atendimento por caixa cadastrada (duplicidade multiplicada); atendente recebe a mesma demanda 2, 3 vezes | 7 | `pollEmailChannel` chama `listUnreadMessages(25)`, que busca sempre `/me/mailFolders/inbox/messages` da conta conectada; `channel.email_address` não entra na consulta | 8 | Dedupe em `email_processed` é por `(email_channel_id, message_id)` — não cobre canais diferentes | 8 | **448** | Filtrar por destinatário (`toRecipients`) da caixa do canal **ou** permitir 1 único canal ativo; adicionar dedupe global por `internetMessageId` |
| A2 | E-mail lido manualmente no Outlook antes do polling | Atendimento nunca é criado, sem registro de erro; demanda perdida em silêncio | 8 | `$filter=isRead eq false` em `listUnreadMessages` | 6 | Nenhum — a mensagem simplesmente sai da lista | 9 | **432** | Trocar o filtro por `receivedDateTime gt <last_polled_at>` (delta), usando o próprio registro de `email_processed` como controle |
| A7 | Anexos ignorados | Fotos, laudos, documentos do cliente não entram no atendimento; operador precisa pedir tudo de novo | 6 | `hasAttachments` vem no `$select` mas nunca é usado; só `body` / `bodyPreview` são lidos | 7 | Nenhum | 7 | **294** | Baixar anexos via Graph e vincular à seção de anexos do atendimento |
| A4 | Conector Outlook desconectado ou token expirado | Nenhum atendimento é criado; o canal cai em `last_poll_status = error` e ninguém é avisado | 9 | `getAuthHeaders` lança quando `MICROSOFT_OUTLOOK_API_KEY` não existe; erros do gateway não têm alerta | 4 | Cartão de status na tela de configurações (passivo, depende de alguém abrir a tela) | 6 | 216 | Alerta ativo quando `last_polled_at` ficar velho demais ou `last_poll_status = error` |
| A6 | Concorrência entre cron e botão "verificar agora" | Duas execuções leem a mesma mensagem antes de gravar `email_processed` → atendimento duplicado | 6 | Não há lock nem índice único garantido | 4 | Checagem de existência (`maybeSingle`) é read-then-write, sujeita a corrida | 7 | 168 | Índice único em `email_processed (email_channel_id, message_id)` + tratamento do erro de conflito |
| A5 | Rate limit / erro transitório do Graph (429, 5xx) | Canal marcado como `error`, mensagens ficam para o próximo ciclo | 5 | Sem retry nem backoff; qualquer status fora de 2xx vira exceção | 5 | Retentativa natural no próximo polling | 5 | 125 | Retry com backoff exponencial (2–3 tentativas) em `outlook.server.ts` |
| A3 | Limite de 25 mensagens por execução, sem paginação | Backlog alto não é drenado em um ciclo; atraso na abertura dos atendimentos | 4 | `listUnreadMessages(25)` ignora `@odata.nextLink` | 5 | Ordenação `receivedDateTime asc` garante que os mais antigos vêm primeiro | 4 | 80 | Paginar até esgotar (com teto por execução) |

---

## 5. Tabela FMEA — B. Criação e dados do atendimento

| ID | Modo de falha | Efeito | S | Causa | O | Controle atual | D | RPN | Ação recomendada |
|----|---------------|--------|---|-------|---|----------------|---|-----|------------------|
| B2 | E-mail gravado no campo de telefone do atendimento | Campo `contact_phone` fica com endereço de e-mail; rotinas que dependem de telefone (WhatsApp, deduplicação, relatórios) se comportam de forma inesperada | 6 | `contact_phone: fromAddr` em `pollEmailChannel` | 10 | Comentário no código ("reutiliza campo p/ identificação") | 5 | **300** | Criar/usar campo próprio de e-mail no atendimento, ou enviar com prefixo identificador |
| B1 | Falha ao gravar `email_processed` depois de criar o ticket | Próximo ciclo cria outro atendimento para o mesmo e-mail (duplicidade real) | 7 | Ordem: ticket → `email_processed` → marcar como lido; o erro do insert em `email_processed` é capturado e só conta em `errors` | 4 | Nenhum — o ticket já existe | 8 | 224 | Gravar o controle de processamento antes (ou em transação) e usar índice único como rede de segurança |
| B5 | Empresa não vinculada ao atendimento | Atendimento órfão, sem contexto de cliente | 4 | Busca em `crm_contacts` por igualdade exata do e-mail; remetente com maiúsculas ou e-mail diferente do cadastro não casa | 7 | `try/catch` silencioso | 4 | 112 | Comparação case-insensitive e fallback por domínio do remetente |
| B3 | `attendance_id` fora do padrão do sistema | Protocolo gerado por `EM-<ts>-<rand>` pode não ser reconhecido por buscas/validações do projeto (existe `src/lib/protocol-format.ts`) | 4 | Gerador próprio, local, dentro de `email-poll.server.ts` | 6 | Nenhum | 4 | 96 | Usar o gerador de protocolo padrão do sistema |
| B4 | Restrição da tabela de atendimentos rejeita o insert | E-mail nunca vira atendimento; erro vai para `last_poll_error` | 8 | `status: "aberto"` e `priority` do enum (baixa/media/alta/urgente) gravados direto | 3 | Erro aparece no painel do canal | 3 | 72 | **Não verificável nesta análise** (estrutura do banco não lida). Conferir as check constraints de `service_tickets` |
| B6 | Corpo do e-mail truncado em 8000 caracteres | Final da mensagem (assinatura, dados úteis) é perdido | 3 | `.slice(0, 8000)` em `notes`; `htmlToPlainText` também é simplificado | 6 | Nenhum | 3 | 54 | Guardar o corpo integral em campo próprio ou anexo |

---

## 6. Tabela FMEA — C. Operação, observabilidade e segurança

| ID | Modo de falha | Efeito | S | Causa | O | Controle atual | D | RPN | Ação recomendada |
|----|---------------|--------|---|-------|---|----------------|---|-----|------------------|
| C1 | Falha do polling não é percebida | Integração parada por horas/dias sem ninguém notar; demanda acumula fora do sistema | 7 | O status só existe na tela de configuração e no campo `last_poll_status` do canal | 6 | Nenhum alerta ativo | 8 | **336** | Monitor + alerta reaproveitando `alert-settings-config` |
| C3 | `CRON_SECRET` ausente/desatualizado no agendador | `/api/public/email-poll` responde 401, a automação para e o painel continua mostrando os canais como ok | 8 | Autenticação por segredo compartilhado, sem telemetria da chamada rejeitada | 3 | Nenhum | 8 | 192 | Registrar chamadas rejeitadas e alertar quando não houver execução bem-sucedida no intervalo esperado |
| C4 | Conteúdo integral do e-mail (PII) guardado em `notes` | Exposição de dados sensíveis conforme a visibilidade do atendimento | 6 | Corpo convertido e gravado em `service_tickets.notes` | 5 | RLS da tabela de atendimentos | 5 | 150 | Revisar RLS e mascarar dados sensíveis na ingestão |
| C5 | `last_poll_error` guarda só os 3 primeiros erros | Investigação sem contexto quando há muitos erros | 2 | `errors.slice(0, 3).join(" | ")` | 8 | Nenhum log estruturado | 3 | 48 | Persistir log/auditoria dos erros por mensagem |
| C2 | Operador sem papel admin/gestor tenta "verificar agora" | Recebe erro genérico de "Falha ao verificar" (a função `triggerEmailPoll` exige admin/gestor) | 2 | Botão visível para todos | 6 | Bloqueio no servidor | 3 | 36 | Esconder/desabilitar o botão para quem não tem papel |
| C6 | `email_processed` cresce sem retenção | Tabela grande, consulta de dedupe mais lenta ao longo do tempo | 2 | Não há política de expurgo | 6 | Nenhum | 3 | 36 | Definir retenção (ex.: 6–12 meses) |

---

## 7. Plano de ação priorizado

**P1 — RPN ≥ 300 (atacar primeiro)**

- **A1 (448):** corrigir a leitura — o polling precisa ler a caixa do canal, não a caixa da conta conectada; enquanto isso não muda, manter apenas **um** canal ativo.
- **A2 (432):** substituir o filtro `isRead eq false` por janela de tempo (`receivedDateTime gt last_polled_at`). É a correção mais barata e a que mais evita perda silenciosa.
- **C1 (336):** criar alerta de polling parado.
- **B2 (300):** parar de gravar e-mail no campo de telefone.

**P2 — RPN 150 a 299**

- A4 (216), B1 (224), C3 (192), A7 (294), A6 (168), C4 (150).

**P3 — RPN abaixo de 150**

- A5 (125), B5 (112), B3 (96), B4 (72, não verificável), A3 (80), B6 (54), C5 (48), C2 (36), C6 (36).

---

## 8. Itens não verificados

A estrutura do banco não foi lida nesta análise. Ficaram pendentes de confirmação:

- existência de índice único em `email_processed` (`email_channel_id`, `message_id`) — impacta A6 e B1;
- check constraints de `service_tickets.status` e `service_tickets.priority` — impacta B4;
- coluna de e-mail usada na busca de `crm_contacts` (nome, tipo e se a comparação é case-insensitive) — impacta B5;
- política de RLS de `service_tickets` para conteúdo de e-mail — impacta C4.

---

## 9. Conclusão

O fluxo funciona no caminho feliz (única caixa ativa, ninguém lendo o Outlook manualmente, conector válido), mas os dois riscos dominantes são **perda silenciosa** (A2: e-mail lido no Outlook nunca vira atendimento, sem erro) e **duplicidade** (A1: um atendimento por caixa cadastrada para o mesmo e-mail). Nenhum dos dois aparece como erro no painel — os canais ficam com status `ok`. As correções A2 e A1 são as que mais reduzem risco por esforço.
