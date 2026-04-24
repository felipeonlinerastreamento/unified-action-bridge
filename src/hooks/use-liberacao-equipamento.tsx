import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LiberacaoCatalogItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export interface TicketLiberacaoItem {
  id: string;
  ticket_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  status: "pendente" | "liberado";
  liberado_at: string | null;
  liberado_by: string | null;
  created_at: string;
}

export const LIBERACAO_CATEGORY_KEYWORDS = [
  "liberação de equipamento",
  "liberacao de equipamento",
];

export function isLiberacaoCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return LIBERACAO_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

export function useLiberacaoCatalog(enabled = true) {
  return useQuery({
    queryKey: ["liberacao-equipamento-catalog"],
    queryFn: async (): Promise<LiberacaoCatalogItem[]> => {
      const { data, error } = await supabase
        .from("liberacao_equipamento_items" as any)
        .select("id, name, description, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useTicketLiberacaoItems(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-liberacao-items", ticketId],
    queryFn: async (): Promise<TicketLiberacaoItem[]> => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("ticket_liberacao_items" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!ticketId,
  });
}
