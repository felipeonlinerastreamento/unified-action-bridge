
# Criar planilha via Google Sheets + Auditoria

## Fluxo desejado
Operador clica **"Criar planilha"** → sistema cria a planilha numa conta Google única da empresa (via conector), define permissão "qualquer pessoa com o link pode editar", salva o link em `chat_controle_links` e abre em nova aba. Todas as ações ficam registradas em `audit_logs`.

## Mudanças

### 1. Conector Google (conta única)
- Vincular o conector **`google_sheets`** (cria a planilha) e o conector **`google_drive`** (define permissão de compartilhamento, pois a Sheets API não controla permissões — quem controla é o Drive).
- Ambos autenticam a mesma conta Google da empresa que o usuário escolher. Operadores não fazem login no Google.

### 2. Server Function `createChatControleSheet` (`src/lib/chat-controle.functions.ts`, novo)
Protegida por `requireSupabaseAuth`. Recebe `{ chatId, contactName, contactPhone, protocol, companyName }`. Passos:
1. Chama `POST https://connector-gateway.lovable.dev/google_sheets/v4/spreadsheets` com título tipo `"Atendimento {protocolo} — {contato}"`.
2. Chama `values:batchUpdate` na nova planilha para preencher o cabeçalho + dados do atendimento (Atendimento, Contato, Telefone, Empresa, Data).
3. Chama `POST https://connector-gateway.lovable.dev/google_drive/v3/files/{id}/permissions` com `{ role: "writer", type: "anyone" }` → "qualquer pessoa com o link pode editar".
4. Faz upsert em `chat_controle_links` com a URL retornada e marca `created_by`.
5. Registra `audit_logs` (evento `controle_link.create`, categoria `central_atendimento`, metadata com `chat_id`, `spreadsheet_id`, `url`).
6. Retorna `{ url, id, label }`.

Headers obrigatórios da gateway: `Authorization: Bearer ${LOVABLE_API_KEY}` + `X-Connection-Api-Key: ${GOOGLE_SHEETS_API_KEY}` (e `GOOGLE_DRIVE_API_KEY` na chamada de Drive).

### 3. Auditoria nas demais ações (`src/lib/chat-controle.functions.ts`)
Criar mais 3 server functions (todas com `requireSupabaseAuth`), substituindo as chamadas diretas a `supabase` que hoje vivem no componente:
- `updateChatControleLink({ id, url, label })` → update + audit `controle_link.update` (metadata: `before`/`after`).
- `deleteChatControleLink({ id })` → delete + audit `controle_link.delete`.
- `logChatControleOpen({ id })` → só audit `controle_link.open` (sem alterar a tabela), chamado quando o operador clica em "Abrir planilha".

Todas gravam `target_type='chat_controle_link'`, `target_id=<id>`, `target_label=<label||url>`.

### 4. `src/components/central/chat-controle-tab.tsx`
- Substituir as 3 mutations atuais (insert/update/delete) por chamadas às novas server functions via `useServerFn` + `useMutation`.
- `handleCreateSheet` passa a chamar `createChatControleSheet` (mostra spinner; em sucesso já abre `data.url` em nova aba e atualiza o cache — não precisa mais do diálogo "cole o link").
- Botão "Abrir planilha" dispara `logChatControleOpen` em paralelo (fire-and-forget) antes de `window.open`.
- Manter o botão **"Adicionar link"** (colar link existente) usando `updateChatControleLink` (insert via mesma fn).
- Em caso de erro do conector (401/sem conexão), mostrar toast pedindo ao admin para reconectar o Google.

### 5. Sem mudanças de schema
A tabela `chat_controle_links` já existe. `audit_logs` já existe e tem helper `writeAuditLog` em `src/lib/audit.server.ts` — reusar.

## Fora de escopo
- OAuth por operador (todos compartilham a conta única do conector, conforme escolhido).
- Pré-preencher conteúdo além do cabeçalho de identificação do atendimento.
- Visualizar logs de auditoria da planilha numa UI dedicada — eles aparecem na tela de auditoria existente.

## Pontos de atenção
- O conector autentica a conta Google do **dono do workspace Lovable**, não cada operador. As planilhas ficam no Drive dessa conta.
- "Anyone with the link can edit" expõe a planilha a qualquer pessoa que receba o link — confirme se está OK para o seu compliance. Alternativa mais restrita (compartilhar por e-mail nominal) exigiria cadastrar e-mails dos operadores.
- Registrar **toda abertura** de planilha pode gerar muitas linhas em `audit_logs`. Se preferir, dá para amostrar (ex.: 1x por sessão/dia) — me avise.
