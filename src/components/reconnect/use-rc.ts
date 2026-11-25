import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { ClientRow, VehicleRow } from "@/lib/reconnect";

// Tabelas rc_* ainda não estão nos tipos gerados até a migração 0057 ser aplicada.
export const rc = supabase as any;

export type RcClient = ClientRow & { company_id: string | null; created_at: string };
export type RcTemplate = { id: string; name: string; subject: string; body: string; is_closing_template: boolean };
export type RcImportTemplate = { id: string; name: string; mapping: { plate: string; client: string; lastCommunication: string; batteryVoltage: string } };
export type RcRecovered = { id: string; plate: string; client_name: string; client_id: string | null; last_days_offline: number; recovered_at: string };

/** Lê todas as linhas (páginas de 1000). */
export async function lerTudo<T>(table: string, order: string, ascending = true, max = 50_000): Promise<T[]> {
  const out: T[] = [];
  for (let de = 0; de < max; de += 1000) {
    const { data, error } = await rc.from(table).select("*").order(order, { ascending }).range(de, de + 999);
    if (error) throw error;
    out.push(...((data || []) as T[]));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export function useRcAccess(userId?: string) {
  return useQuery({
    queryKey: ["rc-access", userId],
    enabled: !!userId,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await rc.rpc("reconnect_allowed");
      if (error) return { ok: false, erro: error.message as string };
      return { ok: data === true, erro: null as string | null };
    },
  });
}

export function useRcData(enabled: boolean) {
  const vehicles = useQuery({ queryKey: ["rc-vehicles"], enabled, queryFn: () => lerTudo<VehicleRow>("rc_vehicles", "plate") });
  const clients = useQuery({ queryKey: ["rc-clients"], enabled, queryFn: () => lerTudo<RcClient>("rc_clients", "name") });
  const recovered = useQuery({
    queryKey: ["rc-recovered"], enabled,
    queryFn: async () => {
      const { data } = await rc.from("rc_recovered_vehicles").select("*").order("recovered_at", { ascending: false }).limit(5000);
      return (data || []) as RcRecovered[];
    },
  });
  const templates = useQuery({
    queryKey: ["rc-templates"], enabled,
    queryFn: async () => ((await rc.from("rc_message_templates").select("*").order("name")).data || []) as RcTemplate[],
  });
  const importTemplates = useQuery({
    queryKey: ["rc-import-templates"], enabled,
    queryFn: async () => ((await rc.from("rc_import_templates").select("*").order("name")).data || []) as RcImportTemplate[],
  });
  return {
    vehicles: vehicles.data ?? [],
    clients: clients.data ?? [],
    recovered: recovered.data ?? [],
    templates: templates.data ?? [],
    importTemplates: importTemplates.data ?? [],
    isLoading: vehicles.isLoading || clients.isLoading,
    error: (vehicles.error || clients.error) as Error | null,
  };
}

export function useRcInvalidate() {
  const qc = useQueryClient();
  return () => ["rc-vehicles", "rc-clients", "rc-recovered", "rc-templates", "rc-import-templates", "rc-history", "rc-notifications", "rc-settings"]
    .forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
}

export async function logRc(userId: string | undefined, action: string, details: Record<string, unknown>) {
  await rc.from("rc_activity_logs").insert({ user_id: userId ?? null, action, details });
}

/** Insere/atualiza em blocos (o servidor limita o tamanho de cada pedido). */
export async function upsertEmBlocos(table: string, rows: any[], onConflict = "id", size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    // Num lote com linhas já existentes (que trazem created_at) e novas (sem), o PostgREST mandaria NULL
    // para quem não tem a coluna. defaultToNull: false usa o valor padrão do banco; e created_at nulo sai.
    const bloco = rows.slice(i, i + size).map((r) => {
      if (r && typeof r === "object" && "created_at" in r && !r.created_at) { const { created_at: _c, ...rest } = r; return rest; }
      return r;
    });
    const { error } = await rc.from(table).upsert(bloco, { onConflict, defaultToNull: false });
    if (error) throw new Error(`${table}: ${error.message}`);
  }
}
