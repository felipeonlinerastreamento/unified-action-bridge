
## Objetivo

Substituir os dados fictícios do "Relatório IA" por análises geradas a partir de dados reais do sistema (chats Z-API, atendimentos, operadores, setores, CSAT, reaberturas), com um **botão "Atualizar análise"** que dispara a IA sob demanda e armazena o último resultado.

## Como o usuário vai solicitar revisão/atualização

Dois pontos de controle na aba **Relatório IA**:

1. **Botão "Gerar nova análise"** (já existe desabilitado em cada view) — passa a ficar ativo. Ao clicar:
   - Mostra loader ("Analisando últimos 30 dias…")
   - Chama server function que coleta dados → envia para Lovable AI Gateway → salva resultado
   - Atualiza a tela com os novos insights + timestamp "Atualizado há X min"
2. **Seletor de período** (7 / 30 / 90 dias) ao lado do botão, para o gestor escolher a janela de análise.
3. **Atualização automática opcional** (configurável): job diário às 6h via `pg_cron` chamando a mesma rota, para que ao abrir a tela já exista análise fresca.

## Arquitetura

```text
[UI Relatório IA]
   │  clica "Gerar nova análise"
   ▼
[serverFn: generateAiManagerReport(period)]
   │  1. Coleta agregados do Supabase (SQL)
   │     - clientes: zapi_chats + service_tickets (recorrência, volume)
   │     - operadores: profiles + zapi_chats fechados (TMA, reaberturas, CSAT)
   │     - setores: sectors + agregados
   │  2. Monta prompt estruturado
   │  3. Lovable AI Gateway (google/gemini-2.5-pro) com Output.object (Zod)
   │  4. Salva em ai_manager_reports (jsonb)
   ▼
[Tabela ai_manager_reports] ← UI lê o mais recente via useQuery
```

## Mudanças no banco

Nova tabela `ai_manager_reports`:
- `period_days` (int: 7/30/90)
- `scope` ('customers' | 'operators')
- `payload` (jsonb — KPIs, listas, markdown gerado)
- `generated_by` (uuid → profiles)
- `generated_at`

RLS: leitura para admin + gestor com `can_access_ai_manager=true`; insert via server function autenticada.

## Coleta de dados reais (queries no Supabase)

**Clientes** (a partir de `zapi_chats` + `service_tickets` + `contacts`):
- Volume de chamados por contato (30/60/90d)
- Recorrência: agrupar por categoria/motivo de finalização
- Score de insatisfação: heurística (nº reaberturas + tempo de espera + tags negativas + CSAT baixo)
- Mapa de sentimento diário: agregação por dia/cliente

**Operadores** (a partir de `profiles` + `zapi_chats` fechados + `csat_responses`):
- Atendimentos, TMA (closed_at - created_at), CSAT médio, reaberturas
- Score de comunicação: calculado pela IA com amostra de mensagens

**Setores** (`sectors` + agregados dos operadores do setor).

## IA — Lovable AI Gateway

Server function `generateAiManagerReport`:
- Modelo: `google/gemini-2.5-pro` (já disponível, sem custo de API extra)
- `Output.object` com schema Zod tipado (mesmas interfaces do `ai-manager-mock.ts`)
- Prompt inclui: agregados numéricos + amostra de transcrições anonimizadas + instruções para retornar markdown PT-BR com insights, alertas, oportunidades e recomendações de treinamento

## Mudanças no frontend

**`src/lib/ai-manager-mock.ts`** vira **`src/lib/ai-manager.ts`**:
- Mantém os tipos
- `mockXxx` viram fallbacks vazios; dados reais vêm do server fn

**`src/lib/ai-manager.functions.ts`** (novo):
- `generateAiManagerReport({ period, scope })` — middleware auth, admin/gestor
- `getLatestAiManagerReport({ scope })` — leitura

**`src/components/ai-manager/customer-analysis.tsx`** e **`operator-performance.tsx`**:
- Trocam imports dos mocks por `useQuery(['ai-report','customers'])`
- Adicionam header com: seletor de período + botão "Gerar nova análise" (com `useMutation`) + "Atualizado em DD/MM HH:mm"
- Estado vazio: "Nenhuma análise gerada ainda — clique em Gerar análise"

## Cron opcional (fase 2)

Rota `src/routes/api/public/hooks/ai-manager-daily.ts` agendada via `pg_cron` 6h diariamente, gerando relatório de 30d para `customers` e `operators`.

## Arquivos

**Criar:**
- migration `ai_manager_reports` + RLS
- `src/lib/ai-manager.functions.ts`
- `src/lib/ai-manager.server.ts` (helpers de coleta SQL)

**Editar:**
- `src/lib/ai-manager-mock.ts` → renomear para `ai-manager.ts`, manter tipos
- `src/components/ai-manager/customer-analysis.tsx`
- `src/components/ai-manager/operator-performance.tsx`

## Perguntas

1. **Janela padrão de análise**: 30 dias está bom, ou prefere 7/90?
2. **Atualização automática diária** (cron 6h) — incluir já agora ou só o botão manual?
3. **Score de insatisfação** — posso usar a heurística (reaberturas + tempo espera + CSAT) ou prefere que a IA também calcule isso?
