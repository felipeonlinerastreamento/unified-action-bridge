# Integração Office 365 → Atendimentos automáticos

## Visão geral

Conectar uma caixa de e-mail Office 365 (Outlook) ao sistema. A cada novo e-mail recebido, será aberto automaticamente um atendimento na fila — exatamente como acontece hoje com mensagens do WhatsApp via Z-API.

## Como funciona

1. Você conecta sua conta Microsoft Outlook (Office 365) através do conector já disponível na Lovable (OAuth — não precisa de senha).
2. O sistema verifica a caixa de entrada periodicamente (a cada 1-2 minutos) buscando e-mails novos não lidos.
3. Para cada e-mail novo:
   - É criado um novo atendimento (`service_tickets`) com canal "E-mail".
   - O remetente vira o "contato" do atendimento (nome + e-mail).
   - O assunto vira a categoria/título.
   - O corpo do e-mail vira a primeira mensagem da conversa.
   - Anexos são salvos no atendimento.
4. O atendimento entra na fila normal e respeita: horário de funcionamento, regras de encaminhamento por setor, identificação automática de cliente (por e-mail/domínio), atribuição etc.
5. Respostas dadas dentro do atendimento podem (opcionalmente, fase 2) ser enviadas de volta como reply do e-mail original.

## O que será construído

### 1. Conexão com Outlook
- Usar o conector **Microsoft Outlook** (OAuth via Lovable) — você só clica em "Conectar" e autoriza com sua conta Microsoft.
- Sem senhas armazenadas, sem App Password, sem configuração no Azure.

### 2. Novo canal "E-mail" no banco
- Adicionar suporte a `platform = 'email'` na tabela `channels`.
- Cada caixa conectada vira um canal (com o endereço de e-mail vinculado).
- Configurações por canal: ativo/inativo, frequência de polling, setor padrão dos tickets gerados.

### 3. Tela de configuração (Configurações → E-mail Office 365)
- Botão "Conectar conta Microsoft" (dispara o OAuth).
- Lista de caixas conectadas com status.
- Configurações: setor padrão, prioridade padrão, ativar/desativar criação automática de tickets, filtro opcional (ex: ignorar e-mails de domínios X).

### 4. Polling automático de e-mails novos
- Cron a cada 1 minuto (via pg_cron) que chama um endpoint `/api/public/email-poll`.
- O endpoint busca via Microsoft Graph: `/me/messages?$filter=isRead eq false&$orderby=receivedDateTime desc`.
- Marca e-mails processados como lidos (ou usa controle interno em uma tabela `processed_emails` para não duplicar).

### 5. Criação automática do atendimento
Para cada e-mail novo:
- Verifica se o remetente já tem contato/empresa cadastrada (busca por e-mail).
- Cria registro em `service_tickets` com:
  - `channel_id` do canal de e-mail
  - `contact_name` = nome do remetente
  - `contact_phone` = e-mail do remetente (reaproveitando o campo)
  - `category` = assunto do e-mail
  - `notes` = corpo do e-mail (texto limpo)
  - `status = 'aberto'`, `priority` configurada
- Salva anexos em `ticket_attachments`.
- Aplica as regras já existentes de horário de funcionamento e roteamento por setor.

### 6. Visualização do atendimento
- Na tela de atendimentos, tickets de e-mail aparecem normalmente, identificados por um ícone de envelope.
- Histórico mostra a thread do e-mail (assunto + corpo + anexos).

## Detalhes técnicos

- **Conector**: `microsoft_outlook` via gateway Lovable (`https://connector-gateway.lovable.dev/microsoft_outlook`).
- **API**: Microsoft Graph v1.0 (`/me/messages`, `/me/messages/{id}/attachments`).
- **Polling**: pg_cron → server route `/api/public/email-poll/$channelId` (similar ao webhook Z-API atual).
- **Nova tabela** `email_processed`: guarda IDs de mensagens já processadas para evitar duplicação.
- **Migração** em `channels`: nova plataforma `email` + novos campos `email_address`, `polling_enabled`.
- **Server function** `pollOutlookMessages` em `src/lib/outlook.server.ts` para encapsular chamadas ao Graph.

## Limitações desta primeira fase

- **Apenas recebimento** de e-mails (entrada → ticket). Responder por e-mail a partir do atendimento fica para uma próxima fase (se você quiser, já incluo).
- Polling a cada 1 min (não é "tempo real"; webhooks do Microsoft Graph exigem endpoint público com renovação a cada 3 dias — viável, mas mais complexo).
- A conta Outlook conectada é compartilhada (ex: `atendimento@suaempresa.com`). Não é uma conta por usuário/atendente.

## Pergunta antes de implementar

Você quer que **também** seja possível **responder o e-mail diretamente de dentro do atendimento** (resposta vai para o remetente como reply do e-mail original) já nesta primeira versão? Ou começamos só com a entrada automática e adicionamos o envio depois?
