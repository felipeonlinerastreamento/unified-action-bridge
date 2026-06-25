## Problema

No relatório **Jornada & Ociosidade**:
- Dia 25/06 não mostra nenhum operador
- Dia 24/06 está faltando Derick, Paulo e Fernanda

## Causa raiz

As duas queries que alimentam o relatório estão sendo **truncadas pelo limite do Supabase**:

1. **`journey-presence`** (eventos `set_online`/`set_offline` em `audit_logs`) — não tem `.limit()` definido, então o Supabase aplica o default de **1000 linhas**.
2. **`journey-activity-logs`** (todos os `audit_logs` para detectar atividade de quem não togglou presença) — tem `.limit(20000)` sem paginação.

Como ambas usam `order("created_at", { ascending: true })` (mais antigos primeiro), quando o volume passa do limite os eventos **mais recentes** (dia 24 final e dia 25 inteiro) são cortados. Por isso o relatório "para" antes de chegar nos dias atuais.

## Solução

Paginar as duas queries em blocos de 1000 linhas usando `.range(offset, offset+999)`, em loop, até esgotar o intervalo. Mesma técnica usada em outros relatórios do projeto.

### Arquivo a alterar

`src/components/relatorios/journey-idle-tab.tsx`

### Mudanças

1. **Query `journey-presence`**: substituir a chamada única por loop paginado de 1000 em 1000 até retornar menos que 1000.
2. **Query `journey-activity-logs`**: idem — paginar em vez de `.limit(20000)`. Manter o `.not("user_id","is",null)` e demais filtros.
3. **Manter** ordenação ascendente final (combinando os chunks) — a lógica de `bump()` e agrupamento por dia não muda.

Não precisa migration. Não mexe em RLS. Não altera Ociosidade nem coluna Início/Finalização — apenas garante que todos os dados do intervalo sejam carregados.

## Verificação

Após o fix, abrir o relatório no período que inclui 23–25/06 e confirmar que:
- Dia 25 mostra operadores que tiveram atividade hoje
- Dia 24 mostra Derick, Paulo e Fernanda
