

## Plano: Integrar Atendimentos com Pendências do GSystem

### Objetivo
Todo atendimento na Central deve automaticamente criar uma pendência na API de Gestão do GSystem. Sub-clientes devem gerar pendências no nome do cliente pai, com dados do sub-cliente na observação. Ao finalizar o chat, a pendência correspondente é marcada como concluída.

### 1. Criar Server Function para orquestrar criação de pendência com lookup de cliente

**Arquivo: `src/lib/gsystem-api.functions.ts`**

Adicionar uma nova server function `createPendenciaFromAtendimento` que:
- Recebe: `attendanceId`, `contactPhone`, `contactName`, `companyId?`, `subClientId?`, `crmContactId?`, `plate?`, `notes?`
- No handler (server-side):
  1. Busca o cliente no GSystem via `getClientes` usando dados da empresa (CNPJ ou nome)
  2. Se não encontrar, cria um cliente básico via `createCliente` com dados mínimos (nome, telefone)
  3. Se for sub-cliente, busca a `company_id` pai no Supabase, usa o cliente da empresa pai no GSystem, e coloca nome/telefone do sub-cliente na observação
  4. Cria a pendência via `POST /pendencias` com: cliente, descrição do atendimento, observação, data
- Retorna a key da pendência criada

### 2. Armazenar referência da pendência no service_ticket

**Migração SQL:**
- Adicionar coluna `pendencia_key text` na tabela `service_tickets` para rastrear a pendência GSystem vinculada

### 3. Integrar criação automática no fluxo de atendimento

**Arquivo: `src/routes/central.tsx`**

- Modificar o `createTicketMutation` (que já roda automaticamente ao selecionar um chat) para, após criar o `service_ticket`, chamar `createPendenciaFromAtendimento`
- Salvar o `pendencia_key` retornado no `service_ticket`
- Se for sub-cliente: passar `subClientId` para que a server function monte a observação corretamente
- Se for CRM contact sem empresa: criar pendência com dados básicos do contato

### 4. Finalizar pendência ao encerrar chat

**Arquivo: `src/routes/central.tsx`**

- No `finalizeMutation`, após finalizar o chat no GSystem:
  - Se o `currentTicket` tiver `pendencia_key`, chamar `cancelarPendencia` (ou um novo endpoint para concluir) para marcar como concluída no GSystem
  - Atualizar o `service_ticket` com status "finalizado"

### 5. Lógica de mapeamento sub-cliente → cliente pai

Na server function `createPendenciaFromAtendimento`:
```text
Se subClientId presente:
  → Buscar sub_client no Supabase (com company_id)
  → Buscar empresa pai (companies) → usar CNPJ/nome para localizar cliente GSystem
  → Observação = "Sub-cliente: {nome} | Tel: {telefone} | {notas}"
  → Pendência criada no nome do cliente pai

Se companyId presente (cliente direto):
  → Buscar empresa → localizar cliente GSystem pelo CNPJ/nome
  → Pendência criada diretamente

Se crmContactId (lead sem empresa):
  → Criar cliente básico no GSystem se necessário
  → Pendência com dados do CRM contact
```

### Arquivos a modificar
- `src/lib/gsystem-api.functions.ts` — nova server function `createPendenciaFromAtendimento` + `concluirPendencia`
- `src/routes/central.tsx` — integrar criação/finalização de pendência nos mutations existentes
- Migração SQL — adicionar `pendencia_key` em `service_tickets`

### Detalhes técnicos
- A busca de cliente no GSystem usa `getClientes` passando CNPJ como identifier
- `createPendencia` já existe e faz `POST /pendencias` — a nova function orquestra os lookups antes de chamar
- `cancelarPendencia` já existe (`PUT /pendencias/{key}/cancelar`) — verificar se é o endpoint correto para concluir, ou se existe outro endpoint de conclusão
- Toda lógica de lookup GSystem roda server-side para não expor tokens

