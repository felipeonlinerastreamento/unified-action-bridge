import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PerdidosCatalogItem {
  id: string;
  name: string;
  default_quantity: number;
  default_unit_value: number;
  is_active: boolean;
}

export interface TicketPerdidosItem {
  id: string;
  ticket_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_value: number;
  total_value: number;
  created_at: string;
  created_by: string | null;
}

export const PERDIDOS_CATEGORY_KEYWORDS = [
  "perdidos",
  "perdido",
  "itens perdidos",
];

export function isPerdidosCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return PERDIDOS_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

export function formatBRL(v: number | null | undefined): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(Number(v ?? 0));
}

export function usePerdidosCatalog(enabled = true) {
  return useQuery({
    queryKey: ["perdidos-catalog"],
    queryFn: async (): Promise<PerdidosCatalogItem[]> => {
      const { data, error } = await supabase
        .from("perdidos_items" as any)
        .select("id, name, default_quantity, default_unit_value, is_active")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
    enabled,
    staleTime: 30_000,
  });
}

export function useTicketPerdidosItems(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-perdidos-items", ticketId],
    queryFn: async (): Promise<TicketPerdidosItem[]> => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("ticket_perdidos_items" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!ticketId,
  });
}
