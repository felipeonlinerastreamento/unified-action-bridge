import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuprimentoCatalogItem {
  id: string;
  name: string;
  default_quantity: number;
  is_active: boolean;
}

export type SuprimentoStatus = "pendente" | "comprado" | "entregue";

export interface TicketSuprimentoItem {
  id: string;
  ticket_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  status: SuprimentoStatus;
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
}

export const SUPRIMENTO_CATEGORY_KEYWORDS = [
  "solicitação de suprimento",
  "solicitacao de suprimento",
  "suprimento",
];

export function isSuprimentoCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return SUPRIMENTO_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

export function useSuprimentoCatalog(enabled = true) {
  return useQuery({
    queryKey: ["suprimento-catalog"],
    queryFn: async (): Promise<SuprimentoCatalogItem[]> => {
      const { data, error } = await supabase
        .from("suprimento_items" as any)
        .select("id, name, default_quantity, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useTicketSuprimentoItems(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-suprimento-items", ticketId],
    queryFn: async (): Promise<TicketSuprimentoItem[]> => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("ticket_suprimento_items" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!ticketId,
  });
}
