

## Plano: Sistema de Chamados com Cadastro de Empresas e Detecao de Placas

### Resumo

Criar um sistema de chamados automaticos vinculados a empresas clientes, com cadastro de empresas (instrucoes, contatos, e-mails), detecao automatica de numero conhecido, exibicao de instrucoes do cliente no painel lateral, e identificacao de placas de veiculo nas mensagens para correlacionar historico de atendimentos.

### Novas Tabelas no Banco de Dados

**1. `companies` -- Cadastro de empresas clientes**
- id, name, cnpj (opcional), phone (telefone principal), emails (text[]), contacts (jsonb -- lista de contatos da empresa), instructions (text -- instrucoes de atendimento), notes, created_at, updated_at

**2. `company_phones` -- Telefones vinculados a empresas (para lookup rapido)**
- id, company_id (FK companies), phone_number (unique), created_at

**3. `service_tickets` -- Chamados de atendimento**
- id, attendance_id (ID do chat GSystem), channel_id, company_id (FK companies, nullable), contact_phone, contact_name, plate (placa do veiculo, nullable), status (enum: aberto/em_andamento/finalizado), opened_by (user_id), notes, created_at, updated_at, closed_at

### Alteracoes na Central de Atendimento (`src/routes/central.tsx`)

**Ao selecionar um chat:**
1. Buscar o numero do contato no chat
2. Consultar `company_phones` para verificar se e um numero conhecido
3. Se encontrado, carregar dados da empresa (instrucoes, contatos, emails) e exibir no **painel lateral direito** (col-span-3)
4. Se nao encontrado, exibir opcao "Vincular a empresa" com busca/cadastro rapido

**Painel lateral direito -- reestruturado em abas:**
- Aba "Contato": dados atuais do contato GSystem
- Aba "Empresa": instrucoes de atendimento, contatos, emails da empresa vinculada
- Aba "Historico": ultimos chamados da placa identificada

**Detecao de placa:**
- Regex no conteudo das mensagens para padroes de placa brasileira (ABC-1234, ABC1D23)
- Quando identificada, buscar em `service_tickets` outros chamados com a mesma placa
- Exibir historico no painel lateral

**Criacao automatica de chamado:**
- Ao abrir/selecionar um chat ativo, verificar se ja existe um `service_ticket` para aquele `attendance_id`
- Se nao existir, criar automaticamente com dados do contato e empresa (se conhecida)
- Campo de placa editavel pelo atendente

### Nova Pagina: Cadastro de Empresas (`src/routes/empresas.tsx`)

- Listagem de empresas cadastradas
- Formulario de cadastro/edicao com: nome, CNPJ, telefones vinculados, emails, contatos, instrucoes de atendimento
- Busca por nome ou telefone

### Arquivos Modificados/Criados

| Arquivo | Acao |
|---------|------|
| Migration SQL | Criar tabelas `companies`, `company_phones`, `service_tickets` com RLS |
| `src/routes/empresas.tsx` | Nova pagina de cadastro de empresas |
| `src/routes/central.tsx` | Painel lateral com abas (empresa, instrucoes, historico placa), criacao auto de chamado, detecao de placa |
| `src/components/app-sidebar.tsx` | Adicionar link "Empresas" no menu |
| `src/lib/gsystem.functions.ts` | Nenhuma alteracao necessaria |

### Fluxo do Atendente

```text
Chat inicia no GSystem
       |
  Sistema detecta numero
       |
  Numero conhecido? ──── Sim ──> Carrega empresa + instrucoes
       |                              |
      Nao                    Cria chamado automatico
       |                    vinculado a empresa
  Exibe "Vincular empresa"
  (busca ou cadastro rapido)
       |
  Atendente vincula
       |
  Durante conversa, regex detecta placa
       |
  Exibe historico de chamados da placa
```

