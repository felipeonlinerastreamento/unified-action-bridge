import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function useMyUserId() {
  return useQuery({
    queryKey: ["gamif-me"],
    queryFn: async () => (await supabase.auth.getUser()).data.user?.id ?? null,
    staleTime: Infinity,
  });
}

export function useRanking() {
  return useQuery({
    queryKey: ["gamif-ranking"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("gamif_ranking");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 60000,
  });
}

export function useSectors() {
  return useQuery({
    queryKey: ["gamif-sectors"],
    queryFn: async () => (await supabase.from("sectors").select("id,name").eq("is_active", true).order("name")).data ?? [],
  });
}

export function useMetrics() {
  return useQuery({
    queryKey: ["gamif-metrics"],
    queryFn: async () => (await supabase.from("gamif_metrics").select("*").order("name")).data ?? [],
  });
}

export function fmtDate(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v.length === 10 ? `${v}T12:00:00` : v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("pt-BR");
}
