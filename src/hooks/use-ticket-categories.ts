import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listTicketCategories } from "@/lib/technical-terms.functions";
import type { CategoryTermRequirement } from "@/lib/technical-terms";

/** Categoria do nosso catálogo, no mesmo formato que as telas usavam do GSystem. */
export type TicketCategoryOption = {
  Key: string;
  Descricao: string;
  gsystemKey: string | null;
  termType: CategoryTermRequirement;
  source: "gsystem" | "local";
};

export const TICKET_CATEGORIES_QUERY_KEY = ["ticket-categories-catalog"] as const;

/**
 * Categorias de chamado ativas (Configurações > Encaminhamento). O servidor
 * sincroniza com o GSystem a cada 30 minutos; quem manda na lista é o nosso sistema.
 */
export function useTicketCategories(opts: { enabled?: boolean } = {}) {
  const list = useServerFn(listTicketCategories);
  return useQuery({
    queryKey: TICKET_CATEGORIES_QUERY_KEY,
    queryFn: async (): Promise<TicketCategoryOption[]> => {
      const rows = (await list({ data: { includeInactive: false } })) as any[];
      return rows.map((r) => ({
        Key: String(r.key),
        Descricao: String(r.label),
        gsystemKey: r.gsystem_key ?? null,
        termType: (r.technical_term_type || "none") as CategoryTermRequirement,
        source: r.source,
      }));
    },
    enabled: opts.enabled ?? true,
    staleTime: 5 * 60_000,
  });
}

/** Acha a categoria pelo nome gravado no chamado. */
export function findCategoryByLabel(list: TicketCategoryOption[], label: string | null | undefined) {
  const l = String(label || "").trim().toLowerCase();
  if (!l) return undefined;
  return list.find((c) => c.Descricao.trim().toLowerCase() === l || c.Key === label);
}
