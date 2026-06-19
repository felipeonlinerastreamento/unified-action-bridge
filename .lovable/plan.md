# Aba "Técnico" no chat + listagem em Contatos

## Objetivo
Permitir cadastrar um "Técnico" (Nome, Telefone, Endereço, Observação) ao vincular um novo contato no chat. O técnico fica vinculado ao número do chat e é listado em **Contatos → Técnicos**.

## 1. Banco de dados (migration)

Nova tabela `public.chat_technicians`:
- `id uuid` (PK)
- `contact_phone text not null` — telefone do chat (normalizado em dígitos) ao qual o técnico pertence
- `name text not null`
- `phone text` — telefone do técnico
- `address text`
- `notes text`
- `created_by uuid` / `created_by_name text`
- `updated_by uuid` / `updated_by_name text`
- `created_at` / `updated_at` (com trigger `update_updated_at_column`)

Índice em `contact_phone`.

GRANTs:
- `GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_technicians TO authenticated;`
- `GRANT ALL ON public.chat_technicians TO service_role;`

RLS (todos autenticados podem ler/escrever, conforme escolhido):
- SELECT/INSERT/UPDATE/DELETE `TO authenticated USING (true) WITH CHECK (true)`.

## 2. Modal de identificação (`src/routes/central.tsx`)

No `Tabs` em `~linha 4125` adicionar 5ª `TabsTrigger value="tecnico"` com ícone `Wrench`/`HardHat`.

Novo `TabsContent value="tecnico"`:
- Campos: Nome (obrigatório), Telefone (default = `contactPhone` do chat, editável), Endereço (Input), Observação (Textarea).
- Validação com `zod` (nome 1-100 chars, demais opcionais com limites).
- Botão "Salvar técnico" → `insert` em `chat_technicians` com `contact_phone = contactPhone normalizado`, captura `created_by`/`name` da sessão.
- Após sucesso: toast, fecha modal, invalida query `["chat-technicians", contactPhone]`.

Também exibir abaixo do formulário a lista de técnicos já cadastrados para este `contact_phone`, cada item com botão excluir (mesmo usuário ou qualquer autenticado, conforme regra) — opcional mas útil.

## 3. Página Contatos (`src/routes/contatos.tsx`)

Adicionar 3ª `TabsTrigger value="tecnicos"` (ícone `Wrench`).

Novo `TabsContent value="tecnicos"` renderiza um novo componente `<TechniciansAdmin />` em `src/components/contatos/technicians-admin.tsx`:
- Lista paginada/filtrável (busca por nome, telefone do técnico ou telefone do contato).
- Colunas: Nome, Telefone, Endereço, Observação, Telefone do contato (chat), Criado por, Atualizado em.
- Ações: editar (dialog com mesmos campos) e excluir (com confirmação).
- Usa `useQuery`/`useMutation` direto no Supabase com RLS.

## 4. Tipos
Após a migration aprovada, `src/integrations/supabase/types.ts` é regenerado e os componentes acima compilam.

## Arquivos
- Migration nova: `supabase/migrations/<timestamp>_chat_technicians.sql`
- Edit: `src/routes/central.tsx` (nova aba no modal de identificação)
- Edit: `src/routes/contatos.tsx` (nova aba "Técnicos")
- Novo: `src/components/contatos/technicians-admin.tsx`

## Fora do escopo
- Não altera tabela de sub-clientes nem CRM.
- Não expõe técnico no painel lateral direito do chat (apenas no modal de vínculo e em Contatos), conforme respondido.
