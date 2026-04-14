

# Plano: Encaminhamento Automático por Categoria

## Contexto atual
O sistema ja exige seleção de categoria antes de finalizar e já possui um mecanismo de fluxos (`service_flows` com `trigger_categories`). Porém o usuário quer um menu de configuração dedicado e simples para definir: "quando a categoria for X, encaminhar para o setor Y".

## O que será feito

### 1. Nova tabela: `category_routing_rules`
Tabela para armazenar regras de encaminhamento por categoria:
- `id` (uuid, PK)
- `category_key` (text) — chave da categoria do GSystem (ex: "Manutenção")
- `category_label` (text) — nome exibido
- `target_sector_name` (text) — setor de destino (ex: "ADM")
- `target_sector_id` (text) — ID do setor no GSystem
- `auto_create_ticket` (boolean, default true) — criar atendimento automático
- `is_active` (boolean, default true)
- `created_at`, `updated_at`
- RLS: Admin/Gestor gerencia, autenticados visualizam

### 2. Nova página de configuração: Encaminhamento por Categoria
**Arquivo:** `src/routes/configuracoes.encaminhamento.tsx`

- Tabela listando as regras existentes (Categoria → Setor destino → Ativo/Inativo)
- Dialog para criar/editar regra:
  - Seletor de categoria (busca do GSystem via `getTiposPendencia`)
  - Seletor de setor destino (busca do GSystem via `listSectors`)
  - Toggle ativo/inativo
- Botões de editar e excluir

### 3. Adicionar link no menu lateral
**Arquivo:** `src/components/app-sidebar.tsx`

- Adicionar item "Encaminhamento" dentro do submenu de Configurações, com ícone `ArrowRightLeft`

### 4. Lógica na finalização da Central
**Arquivo:** `src/routes/central.tsx`

- Na `finalizeMutation`, após finalizar o chat, consultar `category_routing_rules` onde `category_key` = categoria selecionada e `is_active = true`
- Se encontrar regra, criar novo chat no GSystem via `createChat` para o setor de destino configurado
- Criar registro em `service_tickets` vinculado ao novo atendimento
- Toast: "Atendimento encaminhado para o setor {setor}"

### 5. Fluxo visual

```text
Operador finaliza chat → Categoria: "Manutenção"
        │
        ▼
  category_routing_rules WHERE category_key = 'Manutenção' AND is_active
        │
   ┌────┴────────┐
   │ Encontrou   │ → Cria novo chat no setor ADM + ticket → Toast
   └────┬────────┘
   │ Não encontrou │ → Finalização normal
```

### Arquivos modificados
- **Migração SQL** — criar tabela `category_routing_rules` com RLS
- `src/routes/configuracoes.encaminhamento.tsx` — nova página de configuração (CRUD)
- `src/components/app-sidebar.tsx` — novo item no menu
- `src/routes/central.tsx` — lógica de encaminhamento automático na finalização

