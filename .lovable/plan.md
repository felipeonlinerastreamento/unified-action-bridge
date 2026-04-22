

# Fluxo "Teste de Equipamento" + finalização automática para Administrativo + sincronização GSystem

## Objetivo

Quando a categoria do chamado for **"Teste de Equipamento"**, o sistema deve solicitar campos adicionais condicionais (subtipo, cobrança, garantia, motivo). Ao **finalizar** esse atendimento, ele deve ser encaminhado automaticamente para o setor **"Administrativo"** com status **"Aberto"**, e uma pendência correspondente deve ser criada no **GSystem** com toda a descrição do atendimento. Toda essa regra fica gerenciada pela página **Configurações → Encaminhamento por Categoria**.

---

## 1. Novos campos condicionais em "Teste de Equipamento"

### Onde
- `src/components/atendimentos/ticket-create-dialog.tsx` (criação)
- `src/components/atendimentos/ticket-detail-panel.tsx` (edição/finalização)

### Comportamento (em cascata)
```text
Categoria = "Teste de Equipamento"
└── Subtipo *  (Instalação | Retirada | Manutenção)
    └── se Subtipo = "Manutenção"
        ├── Necessário cobrar *  (Sim | Não)
        │   └── se "Sim" → Motivo da cobrança *  (texto livre)
        └── Garantia *            (Sim | Não)
```
- Todos os campos com `*` são **obrigatórios** — bloqueiam o "Criar Ticket" e o "Finalizar".
- Detecção da categoria: `category.toLowerCase().includes("teste de equipamento")` (mesma estratégia já usada para "correios").

### Persistência
Os valores são salvos em `service_tickets.notes` como bloco estruturado no topo:
```
[Teste de Equipamento]
Subtipo: Manutenção
Necessário cobrar: Sim
Motivo: Cliente fora da garantia contratual
Garantia: Não
---
<observações originais do operador>
```
Assim usamos a coluna `notes` (já existente, já enviada ao GSystem na descrição) sem migração extra.

---

## 2. Encaminhamento automático ao finalizar

### Regra
Ao clicar em **Finalizar** num ticket de categoria "Teste de Equipamento":
1. Se a regra estiver ativa em `category_routing_rules`, ler `target_sector_name` (default "Administrativo").
2. Atualizar o ticket: `sector = "Administrativo"`, `status = "aberto"`, `assigned_to = null`, registrar `closed_at` apenas no histórico (comentário sistema), **não** no campo (porque o ticket continua aberto para o setor destino).
3. Inserir comentário sistema: *"Finalizado pelo atendente X e encaminhado automaticamente para o setor Administrativo (status: Aberto)"*.
4. Inserir linha em `ticket_assignments` registrando o encaminhamento.

### Onde implementar
- `src/components/atendimentos/ticket-detail-panel.tsx` → função `updateStatus("finalizado")`: detectar categoria "teste de equipamento", consultar `category_routing_rules`, executar fluxo acima ao invés do update padrão.

---

## 3. Sincronização para o GSystem (criação de pendência)

### Onde
Reaproveitar `createPendencia` em `src/lib/gsystem-api.functions.ts` (já existe, faz `POST /pendencias`).

### Quando
Disparado dentro do `updateStatus("finalizado")` (etapa 2.3), **independente** da categoria — toda finalização sincroniza, mas a regra de Teste de Equipamento garante a montagem da descrição enriquecida.

### Payload (descrição completa)
```
TICKET #<id curto>
Empresa: <companies.name>
Contato: <contact_name>  Telefone: <contact_phone>
Placa: <plate>
Categoria: <category>
Prioridade: <priority>
Setor destino: Administrativo
Aberto em: <created_at>
Finalizado em: <agora>
Atendente: <profile.name>

[Teste de Equipamento]
Subtipo: ...
Necessário cobrar: ...
Motivo: ...
Garantia: ...

OBSERVAÇÕES:
<notes do operador>

HISTÓRICO DE COMENTÁRIOS:
- [data] autor: comentário
- ...
```
- Campos GSystem: `Tipo` (mapeado pela `category_routing_rules.category_key` quando existir), `Descricao` (texto acima), `Cliente` (key GSystem do `companies` — buscado via `entity_links`), `Veiculo` (placa, opcional).
- Em caso de erro na chamada, o ticket continua finalizado/encaminhado localmente e um comentário sistema regista *"Falha ao sincronizar com GSystem: <erro>. Tente novamente em Ações → Sincronizar."* (mantém a operação resiliente).

### Botão de retry manual
Adicionar em `ticket-detail-panel.tsx` aba **Ações** → botão "Sincronizar com GSystem" (visível quando o ticket já está finalizado e ainda não tem `gsystem_pendencia_key` registado).

---

## 4. Gestão na tela "Encaminhamento por Categoria"

### Onde
`src/routes/configuracoes.encaminhamento.tsx` + novo componente `src/components/configuracoes/teste-equipamento-config.tsx`.

### Conteúdo do novo card (entre o card de Sedex e a tabela de regras)
- **Switch**: "Ativar fluxo Teste de Equipamento"
- **Select**: Categoria GSystem que dispara o fluxo (default: "Teste de Equipamento" — autodescoberta na lista de `tiposPendencia`)
- **Select**: Setor destino ao finalizar (default: "Administrativo" — opções vêm de `sectors` + GSystem)
- **Select**: Status no setor destino (Aberto | Em Andamento) — default Aberto
- **Switches**:
  - "Sincronizar automaticamente com GSystem ao finalizar"
  - "Exigir Subtipo"
  - "Exigir Motivo quando 'Necessário cobrar' = Sim"
  - "Exigir Garantia"
- **Botão**: "Salvar configurações"

### Persistência
Nova tabela singleton `teste_equipamento_settings` (mesmo padrão de `tracking_settings`):

```sql
CREATE TABLE public.teste_equipamento_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  is_enabled boolean NOT NULL DEFAULT true,
  trigger_category_key text NOT NULL DEFAULT 'Teste de Equipamento',
  trigger_category_label text NOT NULL DEFAULT 'Teste de Equipamento',
  target_sector_name text NOT NULL DEFAULT 'Administrativo',
  target_status text NOT NULL DEFAULT 'aberto',
  auto_sync_gsystem boolean NOT NULL DEFAULT true,
  require_subtipo boolean NOT NULL DEFAULT true,
  require_motivo_when_cobrar boolean NOT NULL DEFAULT true,
  require_garantia boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now(),
  updated_by uuid
);
-- RLS: leitura para autenticados; escrita só admin/gestor (mesmo padrão de tracking_settings)
-- Insert default row ao final da migration
```

Hook `src/hooks/use-teste-equipamento-settings.tsx` (espelho de `use-tracking-settings`).

---

## 5. Sumário de arquivos

### Criar
- `supabase/migrations/<timestamp>_teste_equipamento_settings.sql`
- `src/hooks/use-teste-equipamento-settings.tsx`
- `src/components/configuracoes/teste-equipamento-config.tsx`
- `src/components/atendimentos/teste-equipamento-fields.tsx` (componente de campos condicionais reutilizado em criação e detalhe)
- `src/lib/ticket-finalize.functions.ts` (server fn `finalizeTicketAndSync` — chama `createPendencia` com a descrição montada e devolve `pendenciaKey`)

### Editar
- `src/components/atendimentos/ticket-create-dialog.tsx` — incluir `<TesteEquipamentoFields>` quando a categoria casar; bloquear submit se obrigatórios faltarem; gravar bloco estruturado no `notes`.
- `src/components/atendimentos/ticket-detail-panel.tsx` — `updateStatus("finalizado")` passa pelo novo fluxo (encaminhar para Administrativo + chamar `finalizeTicketAndSync`); novo botão "Sincronizar com GSystem".
- `src/routes/configuracoes.encaminhamento.tsx` — renderizar `<TesteEquipamentoConfig />` logo após `<TrackingSedexConfig />`.

---

## 6. Detalhes técnicos

- Detecção de categoria no front: `category.trim().toLowerCase() === settings.trigger_category_key.toLowerCase()` (mais robusto que `includes`).
- Encaminhamento ao finalizar é uma operação **transacional best-effort no cliente**: 1) update do ticket; 2) insert em `ticket_assignments`; 3) insert comentário; 4) chamada `finalizeTicketAndSync`. Cada passo trata erro próprio; falha no GSystem não reverte os passos locais.
- Mapeamento GSystem do cliente: `entity_links` onde `entity_type='cliente'` e `local_id = companies.id`. Se não houver vínculo, a sync falha graciosamente e oferece o botão de retry.
- Server fn `finalizeTicketAndSync` reutiliza `gsystemApiFetch` via `createPendencia` — não cria nova rota nem novo segredo.
- O bloco "[Teste de Equipamento]" é parseado via regex simples para preencher os campos de volta na edição.
- Sem mudanças em `service_tickets`: usamos `notes` (estruturado) + `sector` + `status` + `category` que já existem.

