## Objetivo

Adicionar um campo **"Instruções do Gerente IA"** dedicado, separado do Prompt do Sistema, que será injetado no prompt sempre que o relatório de Análise de Clientes ou Performance de Operadores for gerado.

## Onde fica

Na aba **Configurações → Assistente IA → Relatório IA**, no topo das duas views (Clientes e Operadores), um card colapsável **"Instruções do Gerente IA"** com:
- Textarea grande (até 4000 caracteres) com placeholder de exemplos
- Botão "Salvar instruções"
- Subtexto: *"Estas instruções são usadas apenas pelo Gerente IA ao gerar relatórios. Não afetam o atendimento ao cliente."*
- Exemplos clicáveis ("Inserir exemplo"): rigor de TMA, foco em churn, valor mínimo de oportunidade, tom das sugestões.

## Mudanças

**Banco** — nova tabela `ai_manager_settings` (singleton por org):
- `id` (uuid)
- `instructions` (text, default '')
- `updated_by` (uuid → profiles)
- `updated_at`
- RLS: SELECT para admin + gestor com `can_access_ai_manager=true`; UPDATE/INSERT só admin.

**Server functions** (`src/lib/ai-manager.functions.ts`):
- `getAiManagerInstructions()` — retorna a linha atual
- `updateAiManagerInstructions({ instructions })` — admin only
- `generateAiManagerReport` (existente) — passa a ler `ai_manager_settings.instructions` e injeta no prompt como bloco `## Instruções do gestor` antes dos dados agregados.

**Frontend**:
- Novo componente `src/components/ai-manager/manager-instructions-card.tsx` — card colapsável com textarea + save.
- Render no topo de `customer-analysis.tsx` e `operator-performance.tsx`.

## Como a IA usa

No prompt enviado ao Gemini, a seção fica:

```text
Você é um Gerente de Atendimento sênior.

## Instruções do gestor (prioridade alta)
{instructions_do_banco}

## Dados agregados dos últimos {N} dias
{json}

Gere insights em markdown PT-BR ...
```

Se vazio, a seção é omitida e o comportamento atual é mantido.

## Arquivos

**Criar:**
- migration `ai_manager_settings` + RLS
- `src/components/ai-manager/manager-instructions-card.tsx`

**Editar:**
- `src/lib/ai-manager.functions.ts` (3 fns + injeção no prompt)
- `src/components/ai-manager/customer-analysis.tsx` (renderiza card)
- `src/components/ai-manager/operator-performance.tsx` (renderiza card)

## Perguntas

1. As instruções devem ser **únicas e globais** (uma só para toda a operação) ou **separadas** por escopo (uma para Clientes, outra para Operadores)? Sugiro única para começar.
2. Edição restrita a **admin**, ou também **gestor** com permissão `can_access_ai_manager`?
