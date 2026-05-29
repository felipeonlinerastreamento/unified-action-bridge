## Problema (chamado #01838)

A linha "Responsável" no painel é a **união** de `service_tickets.assigned_to` + `ticket_agents.user_id` (linhas 1019–1026 de `ticket-detail-panel.tsx`). No #01838:

- `assigned_to` = **Fernanda** (definida antes)
- Usuário vinculou e depois removeu Kauã via *Atendentes Vinculados*
- Encaminhou para o setor "Laboratorio" 3x — o RPC `pick_least_loaded_agent` retornou `null` (ninguém online/disponível no setor), então **o `assigned_to` nunca foi alterado** → Fernanda continua aparecendo.

Hoje, "Encaminhar para Setor" e "Encaminhar para Usuário" são fluxos separados, e o encaminhamento de setor preserva o responsável antigo quando não encontra ninguém disponível.

## O que vai mudar

### 1. Encaminhar para Setor (sem operador escolhido) — fallback de roteamento

`forwardToSector` em `src/components/atendimentos/ticket-detail-panel.tsx`:

1. Tenta `pick_least_loaded_agent(_sector)` (agentes online + disponíveis para chat).
2. Se retornar `null`, tenta `pick_least_loaded_agent_any(_sector)` (qualquer agente do setor, ignorando presença/disponibilidade) — função já existe no banco.
3. Mesmo se ambas retornarem `null`, **sempre** seta `assigned_to` no update (incluindo `null` quando não houver candidato), para **desvincular** o responsável antigo. Hoje só inclui `assigned_to` no payload quando há agente.
4. Comentário de sistema reflete o novo estado:
   - encaminhado + atribuído a X (menor carga online)
   - encaminhado + atribuído a X (menor carga, agente offline)
   - encaminhado + nenhum atendente no setor → responsável removido

### 2. Encaminhar para Setor (com operador escolhido) — atribuição manual

Adicionar um segundo `Select` opcional ("Operador específico — opcional") logo abaixo do select de setor. O Select de operador filtra para mostrar apenas usuários atribuídos ao setor selecionado (via `user_sector_assignments` + `sectors`), com opção "— Roteamento automático —" no topo.

Quando o operador é escolhido:

- Pula os RPCs, usa o `user_id` selecionado direto como `assigned_to`.
- Atualiza `sector` e `assigned_to` no mesmo update.
- Registra histórico em `ticket_assignments` e comentário "Encaminhado para setor X → atribuído a Y".

### 3. Sem alterações em "Atendentes Vinculados"

O componente `TicketAgentsSection` continua existindo para casos onde se quer adicionar **co-atendentes** sem trocar o responsável principal. Para reduzir a confusão atual, renomear o label da linha 1019 de "Responsável" para **"Responsável / Atendentes"** e separar visualmente: primeiro o responsável (assigned_to) em destaque, depois os co-atendentes em badges menores. Isso evita o caso onde o usuário pensa que vincular um atendente troca o responsável.

## Arquivos afetados

- `src/components/atendimentos/ticket-detail-panel.tsx`
  - `forwardToSector`: fallback para `pick_least_loaded_agent_any`, sempre setar `assigned_to` (mesmo `null`).
  - UI "Encaminhar para Setor": novo `Select` opcional de operador filtrado por setor.
  - Linha 1019 "Responsável": separar visualmente responsável principal × atendentes vinculados.
- Nenhuma migração de banco — `pick_least_loaded_agent_any` já existe.

## Fora de escopo

- Notificar o operador atribuído automaticamente (já existe via realtime do `assigned_to`).
- Mudar o comportamento do botão "Atendentes Vinculados" (continua adicionando co-atendentes, não troca responsável).
- Editar `assigned_to` diretamente clicando no nome do responsável (pode ser feito em seguida se quiser).
