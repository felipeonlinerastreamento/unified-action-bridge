

## Diagnóstico: Vínculo entre Usuários do Sistema e Agentes do GSystem

### Situação Atual

Existem **dois sistemas de usuários completamente independentes**:

1. **Usuários do sistema (Lovable Cloud)**: autenticados via email/senha, armazenados nas tabelas `profiles` e `user_roles`. Identificados por `user_id` (UUID).

2. **Agentes do GSystem**: retornados pela API externa `/users`, com `id`, `name` e `status`. Não possuem nenhuma relação com os usuários do sistema.

**Impacto atual:**
- O campo `opened_by` em `service_tickets` salva o `user_id` do sistema, mas o agente real que atende no chat (`currentUser`) vem do GSystem
- No dashboard, "Performance por Atendente" usa `opened_by` (quem abriu o ticket no sistema), não quem realmente atendeu no GSystem
- Não é possível saber qual usuário do sistema corresponde a qual agente no GSystem
- Filtros por agente na Central usam IDs do GSystem, sem relação com perfis internos

### Plano de Implementação

#### 1. Criar tabela de mapeamento `user_gsystem_links`

```text
user_gsystem_links
├── id (uuid, PK)
├── user_id (uuid, FK profiles) — usuário do sistema
├── gsystem_user_id (text) — ID do agente no GSystem
├── gsystem_user_name (text) — nome no GSystem (cache)
├── channel_id (uuid) — canal associado
├── created_at (timestamp)
└── updated_at (timestamp)
```

Com RLS: admins gerenciam, autenticados visualizam.

#### 2. Tela de vinculação em Configurações > Usuários

Na página `configuracoes.usuarios.tsx`, adicionar:
- Tabela mostrando todos os perfis do sistema com colunas: Nome, Email, Role, Agente GSystem vinculado
- Botão para vincular/desvincular: abre um select com a lista de agentes GSystem (buscados via `listGSystemUsers`)
- Indicador visual de quem está vinculado e quem não está

#### 3. Usar o vínculo na Central de Atendimento

- Ao criar `service_tickets`, além de `opened_by`, salvar também o `gsystem_user_id` do agente atual do chat
- Nos filtros de agente, mostrar o nome do perfil do sistema quando houver vínculo
- No detalhe do chat, exibir o nome do perfil do sistema vinculado ao agente

#### 4. Usar o vínculo no Dashboard/Relatórios

- Métricas de "Performance por Atendente" passam a correlacionar dados do GSystem com perfis do sistema
- Permite relatórios unificados

### Arquivos Afetados

- **Nova migração**: criar tabela `user_gsystem_links`
- **`src/routes/configuracoes.usuarios.tsx`**: tela de gestão com vinculação
- **`src/routes/central.tsx`**: usar vínculo para enriquecer dados de agente
- **`src/routes/dashboard.tsx`**: usar vínculo nas métricas de performance

