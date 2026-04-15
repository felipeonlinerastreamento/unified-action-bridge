

# Plano: Gestão Local de Setores + Verificação da Criação de Usuários

## Resumo
Criar uma tabela de setores locais para que o admin possa cadastrar setores de destino diretamente no sistema, sem depender exclusivamente do GSystem. Verificar e corrigir qualquer problema na criação de usuários.

## O que será feito

### 1. Criar tabela `sectors` no banco de dados
Nova tabela para armazenar setores locais:
- `id` (uuid, PK)
- `name` (text, nome do setor)
- `description` (text, opcional)
- `is_active` (boolean, default true)
- `created_at`, `updated_at`

RLS: admin/gestor gerencia, autenticados leem.

### 2. Tela de gestão de setores
Adicionar uma seção na página de Encaminhamento (ou criar uma sub-rota em Configurações) com:
- Listagem dos setores cadastrados
- Botão "Novo Setor" com dialog para nome e descrição
- Editar/excluir setores existentes
- Toggle ativo/inativo

### 3. Atualizar o dropdown de setor no Encaminhamento
No `configuracoes.encaminhamento.tsx`, combinar os setores do GSystem com os setores locais no dropdown "Setor de Destino", permitindo que o admin escolha qualquer um dos dois.

### 4. Verificar criação de usuários
A criação já usa `email_confirm: true` (sem necessidade de token). Vou garantir que não há nenhum bloqueio adicional e que o fluxo funciona corretamente de ponta a ponta.

## Arquivos

| Ação | Arquivo |
|------|---------|
| Migração | Criar tabela `sectors` com RLS |
| Criar | Seção/componente de gestão de setores |
| Editar | `src/routes/configuracoes.encaminhamento.tsx` — combinar setores locais + GSystem no dropdown |

## Detalhes técnicos
- A tabela `sectors` é independente dos setores do GSystem para dar flexibilidade
- No dropdown de encaminhamento, os setores locais e do GSystem serão listados juntos (com indicação de origem se necessário)
- A criação de usuários já está funcional sem token — nenhuma alteração necessária nesse fluxo

