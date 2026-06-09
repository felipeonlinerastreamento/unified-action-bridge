# Botão "Criar planilha" na aba Controle

## Objetivo
No estado vazio da aba **Controle** (Central e /atendimentos), além de "Adicionar planilha" (colar link existente), incluir botão **"Criar planilha"** que:
1. Abre `https://sheets.new` em nova aba (planilha Google em branco na conta do operador).
2. Copia automaticamente para a área de transferência um cabeçalho com os dados do atendimento, para o operador colar na nova planilha.
3. Mostra um diálogo orientando o operador a, após salvar a planilha no Drive, copiar o link e colar no campo "Adicionar planilha" (que já abre em seguida).

Sem integração com API do Google — apenas abrir nova aba + clipboard + fluxo guiado.

## Mudanças

### `src/components/central/chat-controle-tab.tsx`
- Aceitar nova prop opcional `contactInfo?: { name?, phone?, protocol?, companyName? }` para gerar o cabeçalho.
- No empty state, adicionar segundo botão **"Criar planilha"** (variant secondary) ao lado de "Adicionar planilha".
- Handler `handleCreateSheet()`:
  - Monta TSV com 2 linhas (cabeçalho + valores): `Atendimento\tContato\tTelefone\tEmpresa\tData`.
  - `navigator.clipboard.writeText(tsv)` (com fallback se indisponível).
  - `window.open("https://sheets.new", "_blank", "noopener,noreferrer")`.
  - Toast: "Planilha aberta. Cabeçalho copiado — cole (Ctrl+V) na nova planilha, salve e copie o link aqui."
  - Abre o dialog de "Adicionar planilha" já com label pré-preenchido (ex: "Planilha — {contato}").

### `src/routes/central.tsx`
- Passar `contactInfo` para `<ChatControleTab>` derivado do chat selecionado (nome, telefone, protocolo se houver, empresa).

### `src/components/atendimentos/ticket-detail-panel.tsx`
- Passar `contactInfo` para `<ChatControleTab>` a partir do `ticket` (contact_name, contact_phone, protocol, company name).

## Fora de escopo
- Criar planilha via API Google (exigiria conector / OAuth — usuário escolheu "abrir em branco").
- Pré-preencher conteúdo dentro da planilha automaticamente (não é possível sem API).
- Salvar/recuperar link automaticamente — operador continua colando manualmente.
