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

export function useGamifSettings() {
  return useQuery({
    queryKey: ["gamif-settings"],
    queryFn: async () => {
      const { parseGamifSettings } = await import("@/lib/gamif-rules");
      const { data } = await supabase.from("gamif_settings").select("data").eq("id", "default").maybeSingle();
      return parseGamifSettings(data?.data);
    },
    staleTime: 60000,
  });
}

/** Papéis do próprio usuário, para não decidir acesso antes de carregarem. */
export function useMyRoles() {
  return useQuery({
    queryKey: ["gamif-my-roles"],
    queryFn: async () => {
      const uid = (await supabase.auth.getUser()).data.user?.id;
      if (!uid) return [] as string[];
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      return (data ?? []).map((r) => String(r.role));
    },
    staleTime: 60000,
  });
}

export function useUnreadNotifications(userId: string | null | undefined) {
  return useQuery({
    queryKey: ["gamif-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count } = await supabase.from("gamif_user_notifications").select("id", { count: "exact", head: true }).eq("user_id", userId!).is("read_at", null);
      return count ?? 0;
    },
    refetchInterval: 60000,
  });
}

export function fmtDateTime(v: string | null | undefined) {
  if (!v) return "—";
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export const DUEL_STATUS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pendente: { label: "Aguardando resposta", variant: "outline" },
  ativo: { label: "Em andamento", variant: "default" },
  disputa: { label: "Em disputa", variant: "destructive" },
  concluido: { label: "Concluído", variant: "secondary" },
  recusado: { label: "Recusado", variant: "outline" },
  cancelado: { label: "Cancelado", variant: "outline" },
};

/** Formatação de textos em Markdown (processos e análises da IA) sem plugin de tipografia. */
export const MD_CLASS = "space-y-2 text-sm [&_h1]:text-lg [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:list-decimal [&_ol]:pl-5 [&_strong]:font-semibold [&_a]:underline";
