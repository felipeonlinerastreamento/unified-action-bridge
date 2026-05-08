import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PurchaseItem {
  id: string;
  name: string;
  default_quantity: number;
  item_type: string | null;
  is_active: boolean;
}

export interface PurchaseSupplier {
  id: string;
  name: string;
  cnpj: string | null;
  notes: string | null;
  is_active: boolean;
}

export interface PurchaseSupplierContact {
  id: string;
  supplier_id: string;
  name: string;
  role: string | null;
  phone: string | null;
  email: string | null;
}

export type PurchaseRequestStatus =
  | "solicitado"
  | "cotacao"
  | "comprado"
  | "em_transporte"
  | "entregue";

export interface TicketPurchaseRequest {
  id: string;
  ticket_id: string;
  supplier_id: string | null;
  supplier_contact_id: string | null;
  freight: number;
  tracking_code: string | null;
  expected_delivery: string | null;
  seller_contact: string | null;
  status: PurchaseRequestStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TicketPurchaseLineItem {
  id: string;
  ticket_id: string;
  request_id: string | null;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  status: "pendente" | "comprado" | "entregue";
  delivered_at: string | null;
  delivered_by: string | null;
  created_at: string;
}

export interface PurchaseFlowConfig {
  id: string;
  show_unit_price: boolean;
  show_freight: boolean;
  show_supplier: boolean;
  show_tracking: boolean;
  show_expected_delivery: boolean;
  show_seller_contact: boolean;
  require_unit_price: boolean;
  require_supplier: boolean;
  require_tracking: boolean;
  require_expected_delivery: boolean;
  price_variation_threshold: number;
}

export const PURCHASE_CATEGORY_KEYWORDS = [
  "solicitação de compra",
  "solicitacao de compra",
  "solicitação compra",
  "solicitacao compra",
  // back-compat com nomes antigos
  "solicitação de suprimento",
  "solicitacao de suprimento",
  "suprimento",
  "compra equipamento",
  "compra de equipamento",
  "compra equipamento/chip",
  "compra chip",
];

export function isPurchaseCategory(category?: string | null): boolean {
  if (!category) return false;
  const c = String(category).toLowerCase();
  return PURCHASE_CATEGORY_KEYWORDS.some((k) => c.includes(k));
}

export function usePurchaseItems(activeOnly = true) {
  return useQuery({
    queryKey: ["purchase-items", activeOnly],
    queryFn: async (): Promise<PurchaseItem[]> => {
      let q = supabase.from("purchase_items" as any).select("*").order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 30_000,
  });
}

export function usePurchaseSuppliers(activeOnly = false) {
  return useQuery({
    queryKey: ["purchase-suppliers", activeOnly],
    queryFn: async (): Promise<PurchaseSupplier[]> => {
      let q = supabase.from("purchase_suppliers" as any).select("*").order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 30_000,
  });
}

export function usePurchaseSupplierContacts(supplierId?: string | null) {
  return useQuery({
    queryKey: ["purchase-supplier-contacts", supplierId],
    queryFn: async (): Promise<PurchaseSupplierContact[]> => {
      if (!supplierId) return [];
      const { data, error } = await supabase
        .from("purchase_supplier_contacts" as any)
        .select("*")
        .eq("supplier_id", supplierId)
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!supplierId,
  });
}

export function useTicketPurchaseRequest(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-purchase-request", ticketId],
    queryFn: async (): Promise<TicketPurchaseRequest | null> => {
      if (!ticketId) return null;
      const { data, error } = await supabase
        .from("ticket_purchase_requests" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as any;
    },
    enabled: !!ticketId,
  });
}

export function useTicketPurchaseItems(ticketId?: string | null) {
  return useQuery({
    queryKey: ["ticket-purchase-items", ticketId],
    queryFn: async (): Promise<TicketPurchaseLineItem[]> => {
      if (!ticketId) return [];
      const { data, error } = await supabase
        .from("ticket_purchase_items" as any)
        .select("*")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
    enabled: !!ticketId,
  });
}

export function usePurchaseFlowConfig() {
  return useQuery({
    queryKey: ["purchase-flow-config"],
    queryFn: async (): Promise<PurchaseFlowConfig | null> => {
      const { data, error } = await supabase
        .from("purchase_flow_config" as any)
        .select("*")
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return (data || null) as any;
    },
    staleTime: 60_000,
  });
}

export interface PurchaseItemHistoryEntry {
  id: string;
  ticket_id: string;
  item_id: string | null;
  item_name: string;
  quantity: number;
  unit_price: number;
  created_at: string;
  supplier_id: string | null;
  supplier_name: string | null;
}

export function useLastPurchaseForItem(
  itemName?: string | null,
  excludeTicketId?: string | null
) {
  return useQuery({
    queryKey: ["last-purchase", itemName, excludeTicketId],
    queryFn: async (): Promise<PurchaseItemHistoryEntry | null> => {
      if (!itemName) return null;
      let q = supabase
        .from("v_purchase_item_history" as any)
        .select("*")
        .ilike("item_name", itemName)
        .gt("unit_price", 0)
        .order("created_at", { ascending: false })
        .limit(1);
      if (excludeTicketId) q = q.neq("ticket_id", excludeTicketId);
      const { data, error } = await q;
      if (error) return null;
      const row = (data || [])[0] as any;
      return row || null;
    },
    enabled: !!itemName,
    staleTime: 30_000,
  });
}

export function usePurchaseItemHistory(itemName?: string | null) {
  return useQuery({
    queryKey: ["purchase-item-history", itemName],
    queryFn: async (): Promise<PurchaseItemHistoryEntry[]> => {
      let q = supabase
        .from("v_purchase_item_history" as any)
        .select("*")
        .gt("unit_price", 0)
        .order("created_at", { ascending: false });
      if (itemName) q = q.ilike("item_name", itemName);
      const { data, error } = await q.limit(500);
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 30_000,
  });
}
