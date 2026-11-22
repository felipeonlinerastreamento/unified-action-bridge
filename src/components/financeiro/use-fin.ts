import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";

// As tabelas fin_* ainda não estão nos tipos gerados: acesso sem tipagem até o Lovable regenerar.
export const fin = supabase as any;

export type Lanc = {
  id: string;
  tipo: "pagar" | "receber";
  empresa_id: string | null;
  conta_bancaria_id: string | null;
  categoria_id: string | null;
  contraparte: string | null;
  documento_contraparte: string | null;
  descricao: string | null;
  valor: number;
  data_emissao: string | null;
  vencimento: string | null;
  competencia: string | null;
  data_pagamento: string | null;
  valor_pago: number | null;
  status: "aberto" | "pago" | "cancelado";
  forma_pagamento: string | null;
  tipo_documento: string | null;
  numero_documento: string | null;
  linha_digitavel: string | null;
  origem: string;
  drive_file_id: string | null;
  arquivo_nome: string | null;
  arquivo_url: string | null;
  arquivo_path: string | null;
  ia_confianca: number | null;
  revisado: boolean;
  observacao: string | null;
  created_at: string;
  // Fornecedores / aprovação (migração 0065)
  fornecedor_id?: string | null;
  valor_esperado?: number | null;
  conferencia?: { mes: string | null; status: string; diferenca: number | null; pct: number | null; itens: { descricao: string; quantidade: number; unitario: number; subtotal: number; fonte: string }[]; anteriores: { media: number; pct: number; aumentou: boolean } | null; em: string } | null;
  aprovacao?: "pendente" | "aprovado" | "reprovado" | null;
  aprovado_por?: string | null;
  aprovado_em?: string | null;
  aprovacao_obs?: string | null;
  dda_chave?: string | null;
  nota_chave?: string | null;
  // Agenda de pagamentos (migração 0066)
  data_programada?: string | null;
};
export type Cat = { id: string; nome: string; tipo: "despesa" | "receita"; grupo_dre: string; ativo: boolean; ordem: number };
export type Emp = { id: string; codigo: string; nome: string; cnpj: string | null; ativo: boolean };
export type Conta = { id: string; nome: string; banco: string | null; empresa_id: string | null; saldo_inicial: number; saldo_inicial_data?: string | null; ativo: boolean };

/** Acesso ao Financeiro: só quem está em fin_acesso (Felipe e Patrícia). */
export function useFinanceAccess() {
  const { user } = useAuth();
  const q = useQuery({
    queryKey: ["fin-access", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await fin.rpc("can_access_finance");
      if (error) return false;
      return data === true;
    },
  });
  return { canAccess: q.data === true, isLoading: q.isLoading };
}

export function useFinData(enabled = true) {
  const lanc = useQuery({
    queryKey: ["fin-lancamentos"],
    enabled,
    queryFn: async () => {
      // Lê em páginas de 1000 (limite do servidor) para trazer tudo, inclusive as faturas do GSystem.
      const todos: Lanc[] = [];
      for (let de = 0; de < 50_000; de += 1000) {
        const { data, error } = await fin.from("fin_lancamentos").select("*")
          .order("vencimento", { ascending: true, nullsFirst: false }).order("id").range(de, de + 999);
        if (error) throw error;
        todos.push(...((data || []) as Lanc[]));
        if (!data || data.length < 1000) break;
      }
      return todos;
    },
  });
  const cats = useQuery({
    queryKey: ["fin-categorias"],
    enabled,
    queryFn: async () => {
      const { data } = await fin.from("fin_categorias").select("*").order("ordem").order("nome");
      return (data || []) as Cat[];
    },
  });
  const emps = useQuery({
    queryKey: ["fin-empresas"],
    enabled,
    queryFn: async () => {
      const { data } = await fin.from("fin_empresas").select("*").order("codigo");
      return (data || []) as Emp[];
    },
  });
  const contas = useQuery({
    queryKey: ["fin-contas"],
    enabled,
    queryFn: async () => {
      const { data } = await fin.from("fin_contas_bancarias").select("*").order("nome");
      return (data || []) as Conta[];
    },
  });
  return {
    lancamentos: lanc.data ?? [],
    categorias: cats.data ?? [],
    empresas: emps.data ?? [],
    contas: contas.data ?? [],
    isLoading: lanc.isLoading || cats.isLoading,
    error: lanc.error as Error | null,
  };
}

export function useFinInvalidate() {
  const qc = useQueryClient();
  return () => {
    ["fin-lancamentos", "fin-categorias", "fin-empresas", "fin-contas", "fin-extrato"].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
  };
}
