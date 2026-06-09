
## Objetivo
Adicionar aba **"Controle"** dentro do atendimento (Central e /atendimentos) onde cada operador pode cadastrar e abrir um link de planilha Excel Online específico daquele atendimento. Ao clicar, abre em nova aba do navegador para edição.

## Escopo
- **Por atendimento** (vinculado ao `chat_id` da `zapi_chats`). Cada conversa tem seu próprio link.
- Qualquer operador pode cadastrar/editar/remover o link.
- Abre em nova aba (`target="_blank"`).

## Banco (migração)
Nova tabela `chat_controle_links`:
- `chat_id` (FK → `zapi_chats.id`, único — um link ativo por chat)
- `url` (text, validar https + domínios office/sharepoint/onedrive permitidos no front)
- `label` (text opcional, ex: "Planilha de controle")
- `created_by`, `updated_by` (uuid → auth.users)
- `created_at`, `updated_at`
- RLS: SELECT/INSERT/UPDATE/DELETE para `authenticated` (mesma política aberta usada em outras tabelas operacionais do chat). GRANTs padrão + service_role.

## Frontend
1. **Central de Atendimento** (painel de detalhes do chat à direita): adicionar nova aba "Controle" junto às existentes (Histórico/Tags/etc.).
2. **/atendimentos** (painel do ticket): adicionar a mesma aba "Controle". Como o ticket está vinculado ao chat, usa o mesmo `chat_id`.

### Componente compartilhado `ChatControleTab` (`src/components/central/chat-controle-tab.tsx`)
- Carrega o link atual via `useQuery` (`chat_controle_links` por `chat_id`).
- **Sem link:** mostra estado vazio + botão "Adicionar planilha" → dialog com input URL + label.
- **Com link:** card mostrando label + URL (truncada) + 2 botões:
  - **"Abrir planilha"** (primário) — `window.open(url, "_blank", "noopener,noreferrer")`.
  - **"Editar"** / **"Remover"** (ícones).
- Validação simples no input: precisa começar com `https://` e conter `office.com`, `sharepoint.com`, `onedrive.live.com` ou `1drv.ms` (aviso amigável, não bloqueia hard).
- Mutations com `useMutation` + `qc.invalidateQueries`.
- Toasts via `sonner`.

## Detalhes técnicos
- Sem proxy / sem server function necessários — escrita direta via cliente Supabase com RLS.
- Sem integração com API do Excel/Microsoft (apenas armazena URL).
- Aba aparece para qualquer atendimento que tenha `chatId` conhecido. Em tickets sem chat vinculado, a aba fica oculta.

## Fora de escopo
- Embed/iframe da planilha (decidido: abrir em nova aba).
- Sincronização de conteúdo da planilha.
- Histórico de versões do link.
