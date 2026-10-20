# Opção "Assinar com:" no chat

## O que muda
- No menu de ações do chat, logo abaixo de "Interagir sem apelido", aparece o novo item **"Assinar com:"**, com uma lista dos operadores ativos. Os inativos e os perfis "somente painel" ficam de fora.
- Todos os operadores podem usar a opção.
- Quando um operador é escolhido, a mensagem enviada ao cliente sai com o apelido/nome dele em vez do seu.
- Um selo "Assinando como Paulo" aparece perto da caixa de texto. Um "x" no selo volta para a sua assinatura.
- A escolha vale só para a conversa aberta e é desfeita quando você troca de conversa.
- Se "Interagir sem apelido" ou "Sussurro" for ligado, o "Assinar com" é desligado, e vice-versa.
- **No histórico interno**, a mensagem aparece como "Paulo (enviado por Felipe)". O cliente vê apenas "Paulo".
- A janela flutuante de chat ganha a mesma opção.

## Detalhes técnicos
- `src/routes/central.tsx` e `floating-chat-window.tsx`: novo estado `signAsUserId`, lista de `profiles` ativos (mesmo filtro usado nos seletores de transferência) e um sub-seletor no popover de ações.
- No envio, o prefixo do apelido usa o nome do operador escolhido.
- Registro interno: nova coluna opcional `sent_on_behalf_by_name` em `zapi_messages`, com o nome real de quem enviou. A Central mostra "(enviado por X)" ao lado do nome do remetente.
- A server function de envio passa a aceitar o nome de quem assina e o nome real, gravados na mensagem.
