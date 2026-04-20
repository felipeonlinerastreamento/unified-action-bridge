

# Histórico de observações por empresa

## O que será construído

Ao clicar no nome da empresa na tela **Empresas**, será aberto um painel com:

1. **Campo para adicionar nova observação** (textarea + botão "Adicionar observação")
2. **Histórico cronológico** de todas as observações já feitas, mostrando:
   - Texto da observação
   - Nome do colaborador que registrou
   - Data e hora do registro

Cada funcionário pode adicionar quantas observações quiser. As observações antigas **não podem ser editadas ou apagadas** (preserva o histórico real). O campo `notes` atual da empresa continua existindo para "instruções gerais", mas o novo histórico será independente e auditável.

## Mudanças no banco de dados

Nova tabela `company_observations`:
- `id` (uuid, PK)
- `company_id` (uuid) — referencia a empresa
- `content` (text) — texto da observação
- `created_by` (uuid) — id do usuário que registrou
- `author_name` (text) — nome do colaborador (snapshot, para histórico permanente mesmo se o perfil for alterado)
- `created_at` (timestamp)

**RLS**:
- SELECT: qualquer usuário autenticado pode ver
- INSERT: qualquer usuário autenticado pode adicionar (com `created_by = auth.uid()`)
- UPDATE/DELETE: bloqueado (ou somente admins) para preservar histórico

## Mudanças na interface (`src/routes/empresas.tsx`)

1. Tornar o **nome da empresa** clicável na tabela (estilo link, com hover)
2. Ao clicar, abrir um novo `Dialog` "Observações da Empresa" contendo:
   - Cabeçalho com nome da empresa
   - Textarea para nova observação + botão "Adicionar"
   - Lista (ScrollArea) com histórico em ordem decrescente (mais recente primeiro), cada item com avatar/iniciais, nome do autor, data formatada (ex: "20/04/2026 14:32") e o texto

3. As ações de editar/excluir continuam acessíveis pelos ícones na coluna "Ações" (sem mudança).

## Detalhes técnicos

- Migração SQL para criar `company_observations` com RLS
- `useQuery(["company-observations", companyId])` carrega observações da empresa selecionada
- `useMutation` para inserir nova observação, capturando `auth.uid()` e buscando o nome do perfil atual via tabela `profiles` no momento da inserção (snapshot em `author_name`)
- Após inserir, invalida a query e limpa a textarea
- Formatação de data com `Intl.DateTimeFormat('pt-BR')`

## O que NÃO muda

- Estrutura geral da página Empresas
- Campos existentes (instruções, observações antigas no formulário de edição)
- Permissões para criar/editar empresas

