

## Diagnóstico

O problema principal é que `listAllOpenChats` busca conversas apenas através dos `currentAttendanceId` dos agentes online. Chats na fila de espera, em modo automático, ou sem agente atribuído não são encontrados. Além disso, o endpoint `/chats/list` (que lista todas as conversas) existe mas é usado apenas como fallback e não está integrado na UI.

## Plano de Implementação

### 1. Corrigir carregamento de conversas
- **Alterar `listAllOpenChats`** em `src/lib/gsystem.functions.ts` para usar uma abordagem combinada:
  - Primeiro tentar `/chats/list` com status "OPEN" e "PENDING"
  - Complementar com as conversas dos `currentAttendanceId` dos agentes
  - Fazer merge sem duplicatas por `attendanceId`
- Adicionar suporte a paginação no endpoint

### 2. Adicionar filtros de busca avançados
- **Filtro por status**: Automático, Aguardando, Em Atendimento, Finalizado (todos, ou específico)
- **Filtro por setor**: Dropdown dinâmico populado pelos setores do GSystem
- **Filtro por agente**: Dropdown dinâmico dos agentes/usuários
- **Busca por telefone**: Além de nome, buscar por número do contato
- Criar painel de filtros colapsável acima da lista de chats

### 3. Opção de abrir nova conversa
- Adicionar botão "Nova Conversa" no header da lista de chats
- Criar modal/dialog com:
  - Campo de telefone (obrigatório, formato brasileiro)
  - Mensagem inicial (opcional)
  - Seletor de setor (opcional)
- Usar a server function `createChat` já existente

### 4. Opção de finalizar conversa
- Tornar o botão de finalizar mais visível (com texto, não só ícone)
- Adicionar dialog de confirmação antes de finalizar
- Mostrar opção de adicionar nota de encerramento
- Atualizar o `service_ticket` associado ao finalizar

### Arquivos a modificar
- `src/lib/gsystem.functions.ts` — melhorar `listAllOpenChats` para buscar via `/chats/list` + agentes
- `src/routes/central.tsx` — adicionar filtros, modal de nova conversa, confirmação de finalização

### Detalhes técnicos
- Usar `listSectors` e `listGSystemUsers` (já existentes) para popular filtros dinâmicos
- O `createChat` já está implementado no server — só precisa da UI
- Filtros de status/setor/agente são aplicados client-side sobre os dados já carregados
- Manter polling de 10s para atualização automática

