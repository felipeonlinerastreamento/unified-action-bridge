## Problema

No relatório **Jornada & Ociosidade**, uma linha (operador × dia) só aparece se:

1. Há eventos `set_online`/`set_offline` em `audit_logs` (categoria `presence`), OU
2. O operador enviou mensagens (`zapi_messages.from_me=true`) em chats atribuídos a ele dentro da janela.

Operadores que trabalharam mas não clicaram no toggle de disponibilidade **e** não enviaram mensagens pelo WhatsApp (ex.: trabalharam só em tickets, comentários, transferências, atribuições) ficam invisíveis. Isso explica:

- 25/06 → nenhum (ninguém tocou no toggle nem mandou WhatsApp ainda)
- 24/06 → Derick, Paulo e Fernanda ausentes
- 23/06 → só Davi

## Solução

### 1. Ampliar a detecção de "atividade do dia"

Adicionar uma terceira fonte de atividade: **todos os `audit_logs`** do operador no dia (qualquer `event_category`, não só `presence`). Isso captura qualquer ação registrada: abertura/transferência de chat, comentário em ticket, atualização de status, login, etc.

A linha do operador passa a ser criada quando existe **qualquer** das fontes:
- evento de presença (mantém comportamento atual: calcula tempo online e pausas)
- mensagem enviada (`zapi_messages`)
- **(novo)** qualquer audit log do dia

Quando não há presença, `Tempo Online` continua sendo estimado pelo intervalo da primeira→última atividade (como já faz hoje para o fallback de mensagens), e `Fim` mostra "Em atividade" se a última atividade foi hoje.

### 2. Nova coluna "Início / Finalização"

Adicionar coluna à direita de **Fim** mostrando, em formato `HH:mm → HH:mm`, o horário da **primeira** e **última** atividade do dia, computados pela união de:

- `audit_logs.created_at` (todos os eventos do user/dia)
- `zapi_messages.created_at` (mensagens enviadas)
- eventos de presença

A diferença para as colunas atuais:
- **Início / Fim** atuais refletem só presença (`set_online` / `set_offline`).
- **Início / Finalização** nova reflete a primeira e a última ação real (mesmo sem toggle).

Também incluída no export CSV (`InicioAtividade`, `FimAtividade`).

## Detalhes técnicos

Arquivo: `src/components/relatorios/journey-idle-tab.tsx`

1. Nova query `activity-audit-logs`:
   ```ts
   supabase.from("audit_logs")
     .select("user_id, user_name, created_at")
     .gte("created_at", fromIso).lte("created_at", toIso)
     .order("created_at", { ascending: true })
   ```
   (filtra por `operatorFilter` quando setado; sem `event_category`).

2. No `useMemo` que monta `journeyRows`:
   - Construir índice `activityByUserDay[user::day] = { first, last }` unindo audit_logs + zapi_messages + presence.
   - Após gerar `out` (presença + fallback mensagens), iterar `activityByUserDay`. Para chaves ainda não presentes em `out`, criar linha sintetizada (sem presença) usando `first`/`last` como `firstOnline`/`lastOffline`, `stillOnline = (day === hoje)`, `totalMinutes = (last-first)/60000`.
   - Para todas as linhas, anexar `firstActivity` e `lastActivity` (string ISO) a partir do índice.

3. Tipo `JourneyRow` ganha `firstActivity: string | null; lastActivity: string | null`.

4. Tabela: nova `<TableHead>Início / Finalização</TableHead>` após "Fim", renderizando `${fmtTime(firstActivity)} → ${fmtTime(lastActivity)}` (ou `—`).

5. `exportJourney`: novos campos `InicioAtividade`, `FimAtividade`.

Nenhuma migração necessária.

## Fora de escopo

- Não altera a seção de Ociosidade (gaps de chats), apenas Jornada.
- Não cria registro automático de presença para operadores que esqueceram do toggle — só infere a janela de atividade para exibição.
