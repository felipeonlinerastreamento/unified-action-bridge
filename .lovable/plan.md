# Vincular finalização a protocolo aberto

Objetivo: na tela de "Finalizar atendimento" da Central, mostrar os protocolos em aberto da **mesma empresa** com sua categoria, e permitir que o atendente vincule a conversa a um deles — quando vincular, **não cria um novo ticket**: a interação é anexada ao protocolo existente e o chat é fechado normalmente.

## Comportamento

1. No diálogo de finalização (acima do botão "Finalizar"), nova seção **"Vincular a um protocolo aberto"**.
2. Lista todos os `service_tickets` da `company_id` atual com `status != 'finalizado'`, ordenados por `created_at DESC` (limite 20). Cada item mostra: protocolo formatado, categoria, placa (se houver), atendente que abriu, data.
3. Campo de busca por protocolo/categoria/placa para filtrar a lista.
4. Radio para escolher: "Criar novo protocolo" (padrão) ou um dos protocolos listados.
5. Quando um protocolo existente é selecionado, os campos "Tipo de pendência", "Subcategoria" e "Modelo de equipamento" ficam ocultos/desabilitados (são herdados do protocolo vinculado).
6. Se a empresa não estiver identificada, a seção mostra aviso "Identifique o cliente para ver protocolos em aberto" e o fluxo segue o atual.

## Efeito do vínculo

Quando o atendente confirma a finalização com um protocolo escolhido:

- **Não** cria novo `service_ticket`.
- Atualiza o ticket vinculado: registra um system comment "Atendimento vinculado — chat <protocolo origem> anexado por <usuário>" + observação digitada e cria uma `ticket_activities` do tipo `linked_chat` (referência ao `attendance_id` e ao chat de origem).
- Cria uma linha em `entity_links` (tabela já existente) com `source_type='zapi_chat'`, `source_id=selectedChatId`, `target_type='service_ticket'`, `target_id=<id do protocolo escolhido>` para correlação futura.
- Fecha o `zapi_chat` via `finalizeChat` (igual hoje), preservando `closed_by_user_id`.
- A mensagem de fechamento ao cliente continua opcional (`skipClosingMessage`).
- Pendência GSystem **não** é recriada (a do protocolo vinculado segue aberta).

## Mudanças técnicas

- `src/routes/central.tsx`
  - Nova query `openCompanyTickets` (habilitada quando `companyLookup?.id` existe e `showFinalizeConfirm` está aberto): seleciona `id, attendance_id, plate, category, subcategory_name, opened_by, created_at, status, profiles(name)` filtrando por `company_id` e `status != 'finalizado'`, excluindo o próprio ticket atual.
  - Novo state `linkedTicketId` resetado ao abrir o diálogo.
  - UI dentro do `<Dialog open={showFinalizeConfirm}>` (linhas ~4707–4866): bloco "Vincular a um protocolo aberto" com `Input` de busca, `RadioGroup` com "Criar novo protocolo" + itens da lista; oculta "Tipo de pendência/Subcategoria/Modelo" quando `linkedTicketId` está setado.
  - `finalizeMutation` (linha 1708) recebe `linkedTicketId`. Quando presente, pula toda a criação/atualização de ticket (linhas ~1760–1955) e em vez disso: insere comentário+atividade no ticket alvo, insere `entity_links`, e segue direto para o `finalizeChat` (linha ~2200) e mensagem de encerramento.
  - Validação: quando `linkedTicketId` está setado, não exige `finalizeTipoPendencia`.

- Sem migração nova — `entity_links`, `ticket_comments` (ou helper `insertSystemComment` em `ticket-finalize-flow.ts`) e `ticket_activities` já existem.

## Fora de escopo
- Desfazer vínculo posteriormente.
- Mostrar a lista no painel de Atendimentos (esta tarefa é só na tela de finalização).
- Vínculo cruzado entre empresas diferentes.
