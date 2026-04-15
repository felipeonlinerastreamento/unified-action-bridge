

# Plano: Replicar Fila de Atendimento do GChat

## Resumo
Reformular a lista de chats na Central de Atendimento para replicar o layout do GChat, agrupando atendimentos por categoria (Automático, Aguardando, Fora de hora, Manual, Grupo) com contadores, e exibindo cada chat com avatar, nome, telefone, setor, agente responsável, horário, tags do contato, e última mensagem.

## O que será feito

### 1. Agrupar chats por status (como no GChat)
Os chats já possuem `status` (0=Automático, 1=Aguardando, 2=Em atendimento/Manual). Vamos criar seções colapsáveis para cada grupo:
- **Automático** (status 0) — ícone de bot, fundo azul
- **Aguardando** (status 1) — ícone de clock, fundo âmbar  
- **Fora de hora** — baseado em `timeInOutOfHour > 0` e status específico
- **Manual** (status 2) — ícone de headset, contagem de atendimentos
- **Grupo** — chats de grupo (se disponível na API)

Cada seção terá header clicável com ícone, nome, badge de contagem, e seta para expandir/colapsar.

### 2. Layout de cada item de chat (replicando o screenshot)
Cada chat mostrará:
- **Avatar** do contato (foto ou iniciais)
- **Ícone WhatsApp** ao lado do avatar
- **Nome do contato** + telefone formatado
- **Setor** (badge como "Suporte", "Agendamento")
- **Badge do agente** responsável (nome colorido à direita)
- **Horário** da última mensagem (formato HH:mm à direita)
- **Última mensagem** com prefixo do remetente (ex: "Paulo: aguardando*")
- **Tags do contato** (badges como "Em Testes", "Veículo Sem Comunicação", "Outros Assuntos")
- **Indicador de mensagens não lidas** (badge numérico)

### 3. Componente separado
Extrair a lista de chats para `src/components/central/chat-queue-list.tsx` para manter o `central.tsx` mais organizado. O componente receberá os dados já existentes (filteredChats, gsystemUsers, etc.) via props.

### 4. Cores dos agentes
Atribuir cores automáticas aos agentes para diferenciar visualmente (similar ao GChat onde cada agente tem cor distinta no badge).

## Arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `src/components/central/chat-queue-list.tsx` — novo componente da fila agrupada |
| Editar | `src/routes/central.tsx` — substituir lista inline pelo novo componente |

## Detalhes técnicos
- Os dados já estão disponíveis no `ChatItem`: `status`, `contact.tags`, `currentUser`, `currentSector`, `lastMessage`, `contact.linkImage`, `contact.number`
- O agrupamento será feito com `useMemo` filtrando `filteredChats` por `status`
- Tags do contato vêm de `chat.contact?.tags[]`
- Seções colapsáveis usando estado local (`expandedGroups`)

