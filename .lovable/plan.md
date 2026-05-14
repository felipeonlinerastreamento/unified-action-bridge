## Diagnóstico

A maioria dos lugares já preserva quebra de linha (CSS `whitespace-pre-wrap`). O banco também guarda os `\n` corretamente — confirmei no `ticket_comments`. Porém alguns blocos ainda renderizam o texto sem essa classe, o que faz o navegador colapsar quebras e espaços em uma única linha.

## Mudanças (apenas CSS — sem mexer em lógica)

Vou adicionar `whitespace-pre-wrap break-words` nestes pontos:

1. **AI Assistant (chat lateral)**
   - `src/routes/central.tsx` linha ~3719 — `<p>{msg.content}</p>`
   - `src/components/ai-floating-assistant.tsx` linha ~291 — `<p>{msg.content}</p>`

2. **Lembretes do ticket** (`src/components/atendimentos/ticket-reminder-section.tsx`)
   - Linha 361 — `r.reminder_note`
   - Linha 445 — `h.reminder_note` (histórico)
   - Linha 448 — `h.completion_comment` (histórico)

3. **OKR**
   - `src/components/okr/okr-list.tsx` linha 112 — `obj.description`
   - `src/components/okr/checkin-dialog.tsx` linha 87 — `c.comment`

4. **Descrição do ticket** — vou auditar `ticket-detail-panel.tsx` e adicionar `whitespace-pre-wrap` onde a descrição/observação aparece na visualização (sem alterar Textareas — eles já preservam ao digitar).

5. **Sistema de chat (Central)**
   - O corpo da mensagem (linha 3044) já tem `whitespace-pre-wrap`. Vou apenas conferir que o "reply preview" da mensagem original (`replyingTo.text`) e a citação inline também tenham, para o texto colado aparecer igual ao copiado.

## Pontos intencionalmente NÃO alterados

- Previews truncados com `line-clamp-1/2` (cards de tarefas, sino de notificações, lista de chats) — ali a quebra precisa ficar colapsada para caber em uma/duas linhas.

## Validação

Após o ajuste:
- Colar um bloco de texto com várias linhas em qualquer dos campos acima e abrir/visualizar → o texto deve aparecer exatamente como foi colado, com as quebras de linha preservadas.
- Mensagens existentes no banco (que já têm `\n`) passam a aparecer com a formatação correta automaticamente.
