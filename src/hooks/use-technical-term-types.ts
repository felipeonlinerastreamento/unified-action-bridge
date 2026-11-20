import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isFixedServiceType, type TermType } from "@/lib/technical-terms";

export const TERM_TYPES_QUERY_KEY = ["technical-term-types"] as const;

function toTermType(r: any): TermType {
  return {
    id: String(r.id),
    key: String(r.key),
    label: String(r.label ?? r.key),
    title: String(r.title ?? ""),
    body: String(r.body ?? ""),
    checklist: Array.isArray(r.checklist) ? r.checklist.map((s: unknown) => String(s ?? "").trim()).filter(Boolean) : [],
    requires_equipment_id: !!r.requires_equipment_id,
    whatsapp_template: String(r.whatsapp_template ?? ""),
    email_subject: String(r.email_subject ?? ""),
    email_template: String(r.email_template ?? ""),
    is_active: r.is_active !== false,
    position: Number(r.position) || 0,
    default_service_type: isFixedServiceType(r.default_service_type) ? r.default_service_type : null,
  };
}

/** Tipos de termo cadastrados (Configurações > CRM), em ordem. Inclui inativos. */
export function useTechnicalTermTypes(opts: { enabled?: boolean } = {}) {
  const q = useQuery({
    queryKey: TERM_TYPES_QUERY_KEY,
    enabled: opts.enabled ?? true,
    staleTime: 60_000,
    queryFn: async (): Promise<TermType[]> => {
      const { data, error } = await supabase
        .from("technical_term_types")
        .select("*")
        .order("position", { ascending: true })
        .order("label", { ascending: true });
      if (error) throw error;
      return (data || []).map(toTermType);
    },
  });
  const all = q.data ?? [];
  const active = all.filter((t) => t.is_active);
  return { ...q, all, active, activeKeys: active.map((t) => t.key) };
}
