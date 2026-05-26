## Objetivo

Inverter o padrão atual da Central: mensagens passam a sair **sempre com o apelido do operador** prefixado (`*Nome:* mensagem`), e o operador ganha uma opção explícita **"Interagir sem apelido"** no menu "+" de opções de envio para suprimir o nome em mensagens específicas.

## Mudanças

Arquivo único: `src/routes/central.tsx`

1. **Inverter o estado `nicknameMode`**
   - Trocar `useState(false)` por `useState(true)` (linha 288), de modo que, por padrão, o nome do operador seja prefixado em toda mensagem enviada.
   - Renomear semanticamente o booleano não é necessário — manter `nicknameMode = true` significa "enviar com apelido".

2. **Atualizar a lógica de envio (`handleSend`, ~linha 2327)**
   - Manter a regra atual: se `nicknameMode && !whisperMode && nicknameSource` → prefixa `*Nome:* mensagem`.
   - Quando `nicknameSource` estiver vazio (operador sem nome no perfil), o envio continua sem prefixo automaticamente — sem mudança necessária.

3. **Substituir o item do menu (linhas ~3265–3275)**
   - Remover o `DropdownMenuCheckboxItem` atual "Interagir com apelido".
   - Adicionar no lugar `DropdownMenuCheckboxItem` **"Interagir sem apelido"**:
     - `checked={!nicknameMode}`
     - `onCheckedChange={(v) => { setNicknameMode(!v); if (!v) { /* nada */ } }}` — quando marcado, desliga o apelido.
     - Manter mutua-exclusão com `whisperMode` (sussurro continua tendo prioridade visual).
     - Ícone: trocar `AtSign` por algo como `UserX` (de `lucide-react`) para reforçar "sem nome".
     - `disabled={!profile?.name}` deixa de fazer sentido (sem nome, já não há nome para enviar) — remover o `disabled`.

4. **Indicador visual opcional no campo de mensagem**
   - Quando `!nicknameMode && !whisperMode`, adicionar um badge discreto ou alterar o placeholder do `Textarea` para algo como `"Mensagem será enviada SEM seu nome — Shift+Enter para nova linha"`, para o operador saber que está no modo anônimo. (Aplica-se ao placeholder na linha ~3324.)

## Fora de escopo

- Nenhuma mudança em server functions, banco de dados, RLS ou templates de mensagem.
- Sussurro (`whisperMode`) e respostas rápidas mantêm o comportamento atual.
- Histórico já existente continua exibindo o prefixo `*Nome:*` que foi salvo no momento do envio (a tela de histórico já remove esse prefixo para exibição quando aplicável — `full-conversation-history-dialog.tsx:193`).

## Resultado

- Padrão novo: toda mensagem sai com `*Nome do Operador:* ...`.
- O operador pode marcar **"Interagir sem apelido"** no menu "+" para enviar mensagens sem se identificar; a opção é por sessão/chat selecionado (mesmo escopo do estado atual).