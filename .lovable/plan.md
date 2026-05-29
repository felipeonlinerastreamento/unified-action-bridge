## Problema

O card **"Meu setor"** em `src/components/central/my-attendance-kpis.tsx` hoje conta TODOS os chats em `em_atendimento` dos setores do usuário, somando atendimentos de outros operadores. Resultado: Renato (setor Comercial) vê o badge marcar **3**, mas na sua fila aparece só **1** (os outros 2 estão com outros atendentes do mesmo setor).

## Mudança

Filtrar a query `sector-open-chats` para considerar apenas chats atribuídos ao próprio usuário.

### Arquivo: `src/components/central/my-attendance-kpis.tsx`

Na query `sectorOpenCount` (linhas ~79-92), adicionar `.eq("assigned_to", user.id)`:

```ts
const { data: sectorOpenCount = 0 } = useQuery({
  queryKey: ["sector-open-chats", user?.id, mySectors],
  queryFn: async () => {
    if (!user?.id || mySectors.length === 0) return 0;
    const { count } = await supabase
      .from("zapi_chats" as any)
      .select("id", { count: "exact", head: true })
      .in("sector_name", mySectors)
      .eq("status", "em_atendimento")
      .eq("assigned_to", user.id); // ← novo
    return count || 0;
  },
  enabled: !!user?.id && mySectors.length > 0,
  refetchInterval: 30000,
});
```

Também incluir `user?.id` no `queryKey` para evitar cache cruzado entre usuários.

## Fora do escopo

- Não mexer no label "Meu setor" nem em layout/estilos.
- Não alterar lógica de fila/filtro, realtime, ou outras queries do KPI.
