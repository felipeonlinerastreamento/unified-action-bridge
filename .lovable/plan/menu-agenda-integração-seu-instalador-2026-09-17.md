# Menu Agenda (integração Seu Instalador)

Novo menu **Agenda** na barra lateral, com dois submenus, e a opção de liberar cada um deles na configuração dos grupos de setores.

## O que será criado

**Agenda › Atividades**
- Filtro por período (de/até), status, cliente, técnico e busca por texto.
- Lista paginada das atividades vindas do Seu Instalador.
- Ao clicar em uma atividade: histórico da OS e atalho para o histórico do cliente.
- Botão **Novo agendamento**.

**Agenda › Timeline**
- Seleção de data (padrão: hoje) com navegação dia anterior / próximo dia.
- Visão do dia por técnico/horário, com atualização manual.

**Novo agendamento** (diálogo, disponível nas duas telas)
- Buscar cliente (mínimo 3 letras), escolher tipo de serviço liberado para aquele cliente, escolher técnico ativo, data/hora, duração, identificador (ex.: placa), endereço (ou marcar "sem endereço") e observações.
- Cada tentativa usa uma chave única para evitar agendamento duplicado; em falha de rede a repetição reaproveita a mesma chave.
- Mensagens de erro em português, inclusive conflito de agenda, identificador duplicado e limite temporário.

## Permissão por grupo de setor

- Dois novos itens no catálogo de permissões: "Agenda — Atividades" e "Agenda — Timeline".
- Em Configurações › Grupos de setores, cada grupo pode liberar um, os dois ou nenhum.
- Admin e Gestor enxergam sempre; operadores só veem se o grupo liberar. Se nenhum submenu estiver liberado, o menu Agenda nem aparece.

## Chave de acesso

A integração precisa da chave `SEU_INSTALADOR_INTEGRATION_API_KEY` (a mesma cadastrada no Seu Instalador). Vou pedir esse valor no momento da implementação; sem ela as telas mostram um aviso claro em vez de erro técnico.

## Detalhes técnicos

- `src/lib/seu-instalador.functions.ts`: server functions com `requireSupabaseAuth`, lendo a chave só no servidor (`X-Integration-Key`), enviando `X-External-User-Name` com o nome do perfil autenticado e `X-Request-Id` (UUID). Funções: `listarAtividades`, `consultarTimeline`, `buscarClientes`, `tiposDeServicoDoCliente`, `listarTecnicos`, `historicoOS`, `historicoCliente`, `criarAgendamento` (com `Idempotency-Key`).
- Tratamento de status: 400/401/404/409/429 (respeitando `Retry-After`) /500 mapeados para mensagens em português.
- Rotas: `src/routes/agenda.tsx` (layout com `<Outlet />`), `agenda.atividades.tsx`, `agenda.timeline.tsx`, mais `agenda.index.tsx` redirecionando para Atividades. Cada rota com `head()` próprio.
- Componentes em `src/components/agenda/`: `atividades-content.tsx`, `timeline-content.tsx`, `novo-agendamento-dialog.tsx`, `os-historico-dialog.tsx`.
- Dados via TanStack Query (`useServerFn`), sem chamadas diretas do navegador à API externa.
- `src/lib/menu-catalog.ts`: slugs `agenda.atividades` e `agenda.timeline` em `MENU_CATALOG` e em `URL_TO_MENU_SLUG`; não entram em `DEFAULT_OPERATOR_MENUS`.
- `src/components/app-sidebar.tsx`: grupo colapsável "Agenda" (ícone `CalendarDays`) seguindo o padrão de Configurações, filtrando submenus por `canSeeUrl`.
- Sem alteração de banco de dados.
