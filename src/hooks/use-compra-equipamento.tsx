import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CompraEquipamentoCatalogItem {
  id: string;
  name: string;
  default_quantity: number;
  is_active: boolean;
}

export type CompraEquipamentoStatus = "pendente" | "comprado" | "entregue";

export interface TicketCompraEquipamentoItem {
  id: string;
  ticket_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  status: CompraEquipamentoStatus;
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
}

export const COMPRA_EQUIPAMENTO_CATEGORY_KEYWORDS = [
  "solicitação compra equipamento/chip",
  "solicitacao compra equipamento/chip",
  "solicitação compra equipamento",
  "solicitacao compra equipamento",
  "compra equipamento/chip",
  "compra equipamento",
  "compra de equipamento",
  "compra chip",
];

export function isCompraEquipamentoCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return COMPRA_EQUIPAMENTO_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

export function useCompraEquipamentoCatalog(enabled = true) {
  return useQuery({
    queryKey: ["compra-equipamento-catalog"],
    queryFn: async (): Promise<CompraEquipamentoCatalogItem[]> => {
      const { data, error } = await supabase
        .from("compra_equipamento_items" as any)
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

export function useTicketCompraEquipamentoItems(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-compra-equipamento-items", ticketId],
    queryFn: async (): Promise<TicketCompraEquipamentoItem[]> => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("ticket_compra_equipamento_items" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!ticketId,
  });
}
