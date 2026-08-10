import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface TicketErrorEntry {
  id: string;
  ticket_id: string;
  operator_user_id: string | null;
  operator_name: string;
  description: string | null;
  amount: number;
  created_at: string;
  created_by: string | null;
}

export interface OperatorOption {
  user_id: string;
  name: string;
}

/** Categorias (GSystem) que representam erro operacional/financeiro. */
export const ERROR_CATEGORY_KEYWORDS = ["erro"];

export function isErrorCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return ERROR_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

export function formatBRL(v: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v ?? 0));
}

export function useOperatorOptions(enabled = true) {
  return useQuery({
    queryKey: ["error-operator-options"],
    queryFn: async (): Promise<OperatorOption[]> => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name");
      if (error) throw error;
      return ((data || []) as any[])
        .filter((p) => p.user_id)
        .map((p) => ({ user_id: p.user_id as string, name: (p.name as string) || "Sem nome" }));
    },
    enabled,
    staleTime: 60_000,
  });
}

export function useTicketErrorEntries(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-error-entries", ticketId],
    queryFn: async (): Promise<TicketErrorEntry[]> => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("ticket_error_entries" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!ticketId,
  });
}
