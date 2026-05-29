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

// ============================================================================
// Vínculo Sub-item ↔ Modelos de Equipamento
// ============================================================================

export interface SubcategoryEquipmentModel {
  equipment_item_id: string;
  name: string;
}

/** Retorna os modelos do catálogo (Liberação de Equipamento) vinculados a um sub-item. */
export function useSubcategoryEquipmentModels(subcategoryId?: string | null) {
  return useQuery({
    queryKey: ["subcategory-equipment-models", subcategoryId],
    queryFn: async (): Promise<SubcategoryEquipmentModel[]> => {
      if (!subcategoryId) return [];
      const { data, error } = await supabase
        .from("ticket_subcategory_equipment_models" as any)
        .select("equipment_item_id, liberacao_equipamento_items(id, name, is_active)")
        .eq("subcategory_id", subcategoryId);
      if (error) throw error;
      return ((data || []) as any[])
        .filter((r) => r.liberacao_equipamento_items?.is_active !== false)
        .map((r) => ({
          equipment_item_id: r.equipment_item_id,
          name: r.liberacao_equipamento_items?.name || "",
        }))
        .filter((r) => r.name)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!subcategoryId,
    staleTime: 60_000,
  });
}

/**
 * Igual a `useSubcategoryEquipmentModels`, mas se o sub-item não tiver modelos
 * vinculados, faz fallback para o catálogo completo de Liberação de Equipamento.
 * `isFallback` indica que está mostrando o catálogo inteiro.
 */
export function useSubcategoryEquipmentModelsWithFallback(
  subcategoryId?: string | null,
): { models: SubcategoryEquipmentModel[]; isFallback: boolean; isLoading: boolean } {
  const linked = useSubcategoryEquipmentModels(subcategoryId);
  const catalog = useLiberacaoCatalog(!!subcategoryId);
  const linkedModels = linked.data || [];
  if (linkedModels.length > 0) {
    return { models: linkedModels, isFallback: false, isLoading: linked.isLoading };
  }
  const fallback: SubcategoryEquipmentModel[] = (catalog.data || []).map((c) => ({
    equipment_item_id: c.id,
    name: c.name,
  }));
  return {
    models: fallback,
    isFallback: fallback.length > 0,
    isLoading: linked.isLoading || catalog.isLoading,
  };
}

/** Retorna apenas os IDs vinculados ao sub-item (para preencher o admin). */
export function useSubcategoryEquipmentModelLinks(subcategoryId?: string | null) {
  return useQuery({
    queryKey: ["subcategory-equipment-model-links", subcategoryId],
    queryFn: async (): Promise<string[]> => {
      if (!subcategoryId) return [];
      const { data, error } = await supabase
        .from("ticket_subcategory_equipment_models" as any)
        .select("equipment_item_id")
        .eq("subcategory_id", subcategoryId);
      if (error) throw error;
      return ((data || []) as any[]).map((r) => r.equipment_item_id);
    },
    enabled: !!subcategoryId,
    staleTime: 60_000,
  });
}

/** Contagem por sub-item, para a tabela de configuração. */
export function useAllSubcategoryModelCounts() {
  return useQuery({
    queryKey: ["subcategory-equipment-model-counts"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data, error } = await supabase
        .from("ticket_subcategory_equipment_models" as any)
        .select("subcategory_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of (data || []) as any[]) {
        counts[r.subcategory_id] = (counts[r.subcategory_id] || 0) + 1;
      }
      return counts;
    },
    staleTime: 30_000,
  });
}

/** Sincroniza (delete + insert) os modelos vinculados ao sub-item. */
export async function syncSubcategoryEquipmentModels(
  subcategoryId: string,
  equipmentItemIds: string[],
): Promise<void> {
  const { error: delErr } = await supabase
    .from("ticket_subcategory_equipment_models" as any)
    .delete()
    .eq("subcategory_id", subcategoryId);
  if (delErr) throw delErr;
  if (equipmentItemIds.length === 0) return;
  const rows = equipmentItemIds.map((id, idx) => ({
    subcategory_id: subcategoryId,
    equipment_item_id: id,
    position: idx,
  }));
  const { error: insErr } = await supabase
    .from("ticket_subcategory_equipment_models" as any)
    .insert(rows);
  if (insErr) throw insErr;
}
