## Objetivo

No card **Grupos de Setores** (`Configurações › Usuários`), adicionar configuração de permissões por grupo:

1. **Menus do sistema** liberados para o grupo (multi-select com chips dos menus disponíveis).
2. **Permitir finalizar chat sem enviar mensagem** ao cliente (switch).

Essas permissões valem para **atendentes** atribuídos a setores que pertencem ao grupo. **Admin** e **Gestor** continuam tendo acesso total (ignoram a configuração).

## Modelo de permissão

- Um usuário herda as permissões do **conjunto (união)** de grupos dos setores em que está atribuído (via `user_sector_assignments` → `sectors.group_id` → `sector_groups`).
- Se o usuário **não** pertence a nenhum grupo (ou todos seus grupos estão com `allowed_menus = NULL`), ele cai num **default** que libera todos os menus do operador (comportamento de hoje).
- Quando `allowed_menus` está **definido** num grupo (mesmo que vazio), aquele grupo restringe — a união entre grupos é aplicada.
- `can_finalize_without_message`: `OR` entre todos os grupos do usuário.

## Migrations

`sector_groups`:
- `allowed_menus text[]` (nullable; `NULL` = "sem restrição configurada"; array = lista explícita de slugs).
- `can_finalize_without_message boolean NOT NULL DEFAULT false`.

RLS: manter as policies atuais (admin/gestor gerenciam, todos leem).

## Catálogo de menus (constante no front)

Slugs alinhados com `src/components/app-sidebar.tsx`:

```text
dashboard, central, crm, contatos, empresas, estoque, relatorios, okr,
atendimentos,
config.integracoes, config.central-atendimento, config.fluxo-atendimento,
config.estoque, config.assistente-ia, config.zapi, config.encaminhamento,
config.automacao-sem-comunicacao, config.popup-diario, config.usuarios,
config.status-usuarios, config.notificacoes, config.okr, config.auditoria
```

Arquivo novo `src/lib/menu-catalog.ts` exporta `MENU_CATALOG` (slug → label + grupo "Principal"/"Configurações") e `DEFAULT_OPERATOR_MENUS` (subset historicamente liberado a operadores: `central`, `crm`, `contatos`, `atendimentos`).

## Mudanças no front

### 1. `src/components/configuracoes/sector-groups-management.tsx` (dialog de criar/editar grupo)

Adicionar 2 seções:
- **Menus liberados**: checklist agrupado em "Principal" e "Configurações" usando `MENU_CATALOG`. Toggle "Sem restrição (usar padrão)" → grava `allowed_menus = null`; ao desligar, salva o array selecionado.
- **Finalização**: switch "Permitir finalizar chat sem enviar mensagem ao cliente" → grava `can_finalize_without_message`.

Persistir junto com nome/descrição/ativo. Atualizar a interface `SectorGroup` e o `payload` de `saveMutation`.

### 2. Novo hook `src/hooks/use-user-permissions.tsx`

Resolve, a partir do `user.id`:
- `allowedMenus: Set<string> | null` (`null` = sem restrição). Query: `user_sector_assignments → sectors(group_id) → sector_groups(allowed_menus, can_finalize_without_message)` agregando.
- `canFinalizeWithoutMessage: boolean` (OR entre grupos).
- Admin/Gestor → `allowedMenus = null`, `canFinalizeWithoutMessage = true`.

Expõe `canSeeMenu(slug)` helper. Cache via React Query, chave `["user-permissions", userId]`.

### 3. `src/components/app-sidebar.tsx`

- Importar `useUserPermissions` e `MENU_CATALOG`.
- Em cada `SidebarMenuItem`/`SidebarMenuSubItem` aplicar `canSeeMenu(slug)` para esconder os itens que o operador não pode ver.
- Remover o `adminOnlyUrls` hardcoded para `dashboard/estoque/relatorios/okr` e passar essa decisão para o novo modelo (`DEFAULT_OPERATOR_MENUS` exclui esses, então o comportamento padrão fica igual ao atual).
- Submenu "Configurações" inteiro: se nenhum sub-item for visível, esconder o grupo.

### 4. `src/routes/central.tsx` (diálogo de finalizar)

- Substituir o gate `{isAdmin && (...)}` (linha 4385) e o `isAdmin && skipClosingMessage` (linha 4431) por `canFinalizeWithoutMessage` vindo do `useUserPermissions`.
- Atualizar o texto descritivo: "Encerra silenciosamente — requer permissão do grupo."

## Out of scope

- Não alterar RBAC de rotas (`beforeLoad` de admin/gestor permanece). A nova permissão é só de UI/menu — backend continua protegido por RLS e papéis.
- Não migrar dados existentes: grupos antigos ficam com `allowed_menus = NULL` (sem restrição) e `can_finalize_without_message = false`.
- Não implementar regras por usuário individual (apenas por grupo). Se necessário no futuro, mesmo modelo pode ser estendido com `user_permissions` override.
- CSAT, fluxo de encerramento, mensagem template, escalonamento gestão — não tocados.
