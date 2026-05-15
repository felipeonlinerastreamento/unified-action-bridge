## Objetivo

Adicionar a opção **"Fornecedor"** ao seletor "Tipo de pessoa" no fluxo de cadastro de cliente novo (aba **CRM** do diálogo de identificação na Central de Atendimento). Ao escolher Fornecedor, exibir campos para **categoria** (texto livre) e **observação**.

## Mudanças

### 1. Banco de dados (migration)
- `crm_contacts.contact_type`: aceitar novo valor `'FORN'` (hoje aceita `'PF'` e `'PJ'`). Ajustar CHECK constraint, se houver.
- Adicionar coluna `crm_contacts.supplier_category text` (nullable) — guarda a categoria digitada para fornecedores.

### 2. Backend — `src/lib/company-sync.functions.ts`
- `createCrmContactSchema`:
  - `contactType: z.enum(["PF", "PJ", "FORN"]).optional()`
  - novo `supplierCategory: z.string().max(255).optional()`
- `createCrmContactWithCompany.handler`:
  - Normalizar `contactType` permitindo `FORN`.
  - Quando `FORN`: `category_id = null`, gravar `supplier_category` no insert; empresa permanece opcional (não exigida).
  - Demais casos inalterados.

### 3. Frontend — `src/routes/central.tsx`
- `identForm` state: alterar tipo `contactType: "PF" | "PJ"` → `"PF" | "PJ" | "FORN"`; adicionar `supplierCategory: string` (default `""`); resetar nos pontos onde `identForm` é reinicializado.
- Aba **"Cadastrar no CRM"** (linhas ~4019-4250):
  - Trocar o grupo de 2 botões por 3 botões (PF · Pessoa Física | PJ · Pessoa Jurídica | Fornecedor). Layout em grid de 3 colunas para caber bem em 1336px.
  - Quando `contactType === "FORN"`: renderizar bloco com:
    - Input "Categoria *" (`identForm.supplierCategory`)
    - Textarea "Observação" — reutiliza o campo `notes` que já existe abaixo (para evitar duplicar). Adicionar apenas um hint visual de que é obrigatória a categoria.
  - Esconder os blocos exclusivos de PJ (categoria PJ, razão social, CNPJ, itens de contrato) quando tipo for FORN.
- `createCrmContactMutation`: enviar `contactType` e `supplierCategory` quando aplicável; validação do botão exige `name` + (se FORN) `supplierCategory`.

### 4. Tipos Supabase
- Atualizados automaticamente após a migration; nada a editar manualmente.

## Fora do escopo
- Listagem/edição de fornecedores em outras telas (CRM list, contatos). Apenas o cadastro inicial pelo chat. Pode-se evoluir depois.

## Riscos
- A constraint atual de `contact_type` (se existir como CHECK ou enum) pode rejeitar `FORN` antes da migration. A migration trata isso explicitamente.
