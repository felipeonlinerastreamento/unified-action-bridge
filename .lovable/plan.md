## Bug

O `CompanySharedNote` é renderizado uma única vez no painel direito da Central. Quando o operador troca de chat (mudando a empresa identificada), o componente é reutilizado com novo `companyId`, mas o `useState` interno mantém o `content` digitado/exibido para a empresa anterior. Como o `useEffect` que sincroniza o conteúdo da query só atualiza quando `dirty === false`, basta o usuário ter editado o texto da empresa anterior (sem salvar) para o texto "viajar" para todas as outras empresas.

## Fix

Em `src/components/central/company-shared-note.tsx`:

- Resetar `content` e `dirty` sempre que `companyId` mudar, antes da query nova retornar — assim o textarea fica vazio enquanto carrega e a empresa correta sempre é exibida.
- Substituir o `useEffect([data?.content, dirty])` por um efeito que dispara em `[companyId, data?.content]` e usa `dirty` apenas como guarda interna via ref (não como dependência), evitando o caso em que `dirty` da empresa A bloqueia a hidratação da empresa B.

Em `src/routes/central.tsx` (linha 3795): adicionar `key={companyLookup.id}` no `<CompanySharedNote />` como reforço — garante remount quando a empresa muda, eliminando qualquer estado residual.

Sem migração nem mudanças no schema (`company_shared_notes` já é por `company_id`).
