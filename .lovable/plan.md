
## Objetivo

1. No cadastro de empresa, organizar o formulário em abas e adicionar três novas: **Script Manutenção**, **Script Instalação** e **Padrão Serviços**.
2. Em **Padrão Serviços**, permitir inserir/editar/excluir itens (cada item com nome e descrição).
3. Em tickets da categoria **Liberação de Equipamento**, quando o ticket for vinculado a uma empresa, trazer automaticamente na descrição do serviço o item do "Padrão Serviços" da empresa; se houver mais de uma opção, deixar o operador escolher qual inserir (com possibilidade de combinar várias).

## Mudanças

### 1. Banco de dados (migration)

- Adicionar colunas em `public.companies`:
  - `maintenance_script text` (default `''`)
  - `installation_script text` (default `''`)
- Nova tabela `public.company_service_templates`:
  - `id uuid pk`, `company_id uuid fk companies(id) on delete cascade`
  - `name text not null` (nome do item, ex. "Instalação Padrão")
  - `description text not null default ''` (texto que será injetado na descrição do ticket)
  - `position int default 0`, `created_at`, `updated_at`
  - GRANTs para `authenticated` e `service_role`; RLS habilitado.
  - Policies: leitura/escrita para `authenticated` (mesmo padrão usado em `companies`/`company_phones` hoje).
  - Trigger `update_updated_at_column`.

### 2. Cadastro de empresa (`src/routes/empresas.tsx`)

Reorganizar o `Dialog` de criar/editar empresa em `Tabs` (manter todos os campos atuais):

```text
[ Dados ] [ Contatos ] [ Instruções ] [ Script Manutenção ] [ Script Instalação ] [ Padrão Serviços ] [ Observações ]
```

- **Dados**: nome, CNPJ, telefone principal, telefones extras, e-mails.
- **Contatos**: lista atual de contatos.
- **Instruções**: campo `instructions` atual.
- **Script Manutenção**: `Textarea` ligado a `maintenance_script`.
- **Script Instalação**: `Textarea` ligado a `installation_script`.
- **Padrão Serviços**: CRUD inline (lista + botões adicionar/editar/excluir) dos itens em `company_service_templates`. Cada item: `name` (Input) + `description` (Textarea). Salvar junto com a empresa (após upsert dos demais campos, sincronizar a lista: insert dos novos, update dos editados, delete dos removidos).
- **Observações**: campo `notes` atual.

### 3. Ticket de Liberação de Equipamento (`src/components/atendimentos/ticket-create-dialog.tsx`)

- Quando `isLiberacao && company_id` estiverem definidos, buscar `company_service_templates` da empresa (TanStack Query).
- Comportamento:
  - **0 templates**: nada muda.
  - **1 template**: ao selecionar a categoria "Liberação de Equipamento" e a empresa, **pré-preencher** o campo `description` do ticket com `template.description` (apenas se a descrição estiver vazia; nunca sobrescrever texto digitado pelo operador).
  - **2+ templates**: mostrar um seletor "Padrão de serviço" acima da descrição com botões "Inserir" por item — clicar acrescenta a descrição do template ao campo de descrição (append com quebra de linha), permitindo combinar vários.
- UI nova fica próxima ao bloco `LiberacaoEquipamentoFields`, condicional a `isLiberacao` + empresa selecionada.

## Detalhes técnicos

- Reaproveitar o cliente Supabase do browser (`@/integrations/supabase/client`) já usado nesses arquivos — não há mudança no padrão de auth/serverFn.
- Após a migration, `src/integrations/supabase/types.ts` é regenerado automaticamente; usar os tipos novos sem `as any` quando possível.
- Validações: `name` obrigatório nos itens de Padrão Serviços; demais campos opcionais.
- Sem alteração de RLS além das policies da nova tabela.

## Fora de escopo

- Edição dos scripts a partir de outras telas (somente cadastro da empresa).
- Uso automático dos scripts em outras categorias de ticket (só "Liberação de Equipamento" recebe pré-preenchimento agora).
