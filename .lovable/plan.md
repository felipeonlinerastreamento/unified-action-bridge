## 1. Editar oportunidades existentes no Pipeline

Hoje os cards do Kanban (`src/components/crm/crm-pipeline-tab.tsx`) só permitem mover de etapa. Vou:

- Adicionar botão "Editar" (ícone lápis) em cada card de oportunidade.
- Reaproveitar o mesmo `Dialog` do "Nova oportunidade" — quando `editingId` está setado, ele carrega os dados da oportunidade (título, contato, empresa, categoria, indicação, itens, probabilidade, observações, tipo) e ao salvar chama `upsertOpportunity({ data: { id: editingId, ... } })` (já suportado no server function).
- Botão "Excluir" com confirmação (DELETE em `crm_opportunities`).
- Limpar form / `editingId` ao fechar o dialog.

## 2. Nova aba "Fluxos & Lembretes" no CRM

Adicionar uma nova `TabsTrigger` em `src/routes/crm.tsx` chamada **"Fluxos"** (ícone `Workflow`), apontando para um novo componente `src/components/crm/crm-flows-tab.tsx`.

### Modelo de dados (migração)

Reutilizar a infra existente `crm_postsale_rules` + `crm_postsale_steps` (já presente no banco e processada diariamente em `src/lib/crm-daily.server.ts`), expandindo-a para servir também ao pipeline comercial:

```sql
ALTER TABLE crm_postsale_rules
  ADD COLUMN trigger_type text NOT NULL DEFAULT 'sector',
  -- 'sector' (atual) | 'pipeline_stage' | 'opportunity_lost' | 'contact_category' | 'birthday'
  ADD COLUMN trigger_stage_id uuid REFERENCES crm_pipeline_stages(id),
  ADD COLUMN trigger_category_id uuid REFERENCES crm_categories(id),
  ADD COLUMN final_category_id uuid REFERENCES crm_categories(id),
  -- ao terminar todos os steps move o contato/oportunidade para esta categoria
  ADD COLUMN final_stage_id uuid REFERENCES crm_pipeline_stages(id);

ALTER TABLE crm_postsale_steps
  ADD COLUMN move_to_category_id uuid REFERENCES crm_categories(id),
  ADD COLUMN move_to_stage_id uuid REFERENCES crm_pipeline_stages(id);
  -- step pode opcionalmente já reclassificar antes do final
```

A fila `crm_postsale_queue` já existe e cria tarefas em `crm_tasks`. Estendê-la para também aceitar `opportunity_id`:

```sql
ALTER TABLE crm_postsale_queue
  ADD COLUMN opportunity_id uuid REFERENCES crm_opportunities(id) ON DELETE CASCADE;
```

### UI da aba (crm-flows-tab.tsx)

- Lista de regras (cards) com nome, gatilho legível ("Quando entrar na etapa Proposta Enviada"), nº de passos, switch ativo/inativo.
- Dialog de edição com:
  - **Nome**
  - **Gatilho**: select de tipo + select dependente (etapa do pipeline / categoria / setor).
  - **Passos** (lista ordenável): `delay_days` (input) + `action_type` (whatsapp / task / email / nps) + `title` + `description/template` + opção "Reclassificar para categoria X" no passo.
  - **Ao final**: select "Mover contato para categoria…" e/ou "Mover oportunidade para etapa…".
- Botão "Adicionar passo" (já modelado em `upsertPostsaleRule`).

Salvar via `upsertPostsaleRule` (estender o validador para aceitar os novos campos).

### Disparo automático

- **Trigger por etapa do pipeline**: criar trigger PG em `crm_opportunities` que, quando `stage_id` muda, insere registros em `crm_postsale_queue` para cada `crm_postsale_steps` da regra correspondente, com `scheduled_for = now() + delay_days`.
- **Trigger por categoria do contato**: trigger em `crm_contacts` (insert/update de `category_id`).
- **Trigger por setor (já existe)**: mantido.
- O job diário `crm-daily.server.ts` já processa a fila — apenas estender para também executar `move_to_category_id`/`move_to_stage_id` no passo correspondente.

## 3. Exemplo concreto (caso do usuário)

Uma regra "Acompanhamento de Proposta" com:
- Gatilho: etapa **Proposta Enviada**
- Passo 1: D+3 → WhatsApp "Olá, confirmou recebimento da proposta?"
- Passo 2: D+6 → WhatsApp "Posso esclarecer alguma dúvida?"
- Passo 3: D+13 → Tarefa "Ligar para fechar"
- Final: mover contato para categoria **"Lead frio – reativar"**

## 4. Outros fluxos sugeridos para o menu comercial

Podem virar templates pré-prontos no botão "Criar a partir de template":

1. **Boas-vindas pós-venda** — D+1 agradecimento, D+7 onboarding, D+30 NPS.
2. **Renovação de contrato** — D-60 alerta gestor, D-30 WhatsApp cliente, D-15 ligação, D-7 e-mail formal.
3. **Recuperação de oportunidade perdida** — após 60/120/180 dias da perda, reabordagem leve; muda categoria para "Reciclagem".
4. **Reativação de cliente inativo** — sem atendimentos há 90 dias → mensagem + tarefa para gestor de conta.
5. **Aniversário do cliente / da empresa** — mensagem automática (já existe aba Aniversários, integrar).
6. **Pesquisa CSAT pós-fechamento** — 7 dias após oportunidade ganha.
7. **Cobrança / boleto vencido** — D+1, D+5, D+10 com escalonamento.
8. **Cross-sell por categoria** — após X dias na categoria "Cliente ativo", oferecer produto complementar.
9. **Indicação (referral)** — 30 dias após ganho, pedir indicação ao contato.
10. **Lead sem resposta** — 3 tentativas de contato em D+0/D+2/D+5; sem resposta → categoria "Lead morto".

## Detalhes técnicos

- **Arquivos novos**: `src/components/crm/crm-flows-tab.tsx`, migração SQL.
- **Arquivos editados**: `src/components/crm/crm-pipeline-tab.tsx` (editar/excluir), `src/routes/crm.tsx` (nova aba), `src/lib/crm.functions.ts` (estender `upsertPostsaleRule` + nova `deleteOpportunity` + `enqueuePipelineFlow`), `src/lib/crm-daily.server.ts` (executar `move_to_*`).
- **RLS**: as novas colunas herdam as policies existentes das tabelas (admin/gestor escrevem, atendentes leem).
- **Sem novos secrets** — usa Lovable Cloud + WhatsApp já configurado.
