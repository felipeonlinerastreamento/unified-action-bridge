/**
 * Sincroniza equipamentos do GSystem para a tabela espelho local.
 * Usa GET /equipamentos com paginação por Cursor (Limit=200).
 * Server-only.
 */
import { gsystemApiFetch } from "@/lib/gsystem-api.server";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

interface Equipamento {
  Codigo: number;
  DisplayName?: string;
  Equipamento?: string;
  Serie?: string;
  Observacao?: string;
  Comunicacao?: string;
  Empresa?: unknown;
  Parametros?: unknown;
  [k: string]: unknown;
}

export async function syncGsystemEquipamentos(): Promise<{
  ok: boolean;
  itemsCount: number;
  removed: number;
  error?: string;
}> {
  const runStart = new Date();

  // marcar início
  await supabaseAdmin.from("gsystem_sync_status").upsert({
    id: "equipamentos",
    last_started_at: runStart.toISOString(),
    updated_at: new Date().toISOString(),
  });

  try {
    let cursor: string | undefined;
    let total = 0;

    do {
      const qs = new URLSearchParams();
      qs.set("Limit", "200");
      if (cursor) qs.set("Cursor", cursor);
      const res: any = await gsystemApiFetch(`/equipamentos?${qs.toString()}`, "GET");

      // pode vir array puro ou { Items, Pagination: { NextCursor } }
      const items: Equipamento[] = Array.isArray(res)
        ? res
        : (res?.Items ?? res?.items ?? res?.data ?? []);
      cursor = Array.isArray(res)
        ? undefined
        : (res?.Pagination?.NextCursor ?? res?.pagination?.nextCursor ?? undefined);

      if (items.length === 0) break;

      const rows = items
        .filter((it) => typeof it.Codigo === "number")
        .map((it) => ({
          codigo: it.Codigo,
          display_name: it.DisplayName ?? null,
          equipamento: it.Equipamento ?? null,
          serie: it.Serie ?? null,
          observacao: it.Observacao ?? null,
          comunicacao: it.Comunicacao ?? null,
          empresa: (it.Empresa ?? null) as any,
          parametros: (it.Parametros ?? null) as any,
          raw: it as any,
          synced_at: new Date().toISOString(),
        }));

      const { error } = await supabaseAdmin
        .from("gsystem_equipamentos")
        .upsert(rows, { onConflict: "codigo" });
      if (error) throw error;

      total += rows.length;
    } while (cursor);

    // remove registros que sumiram do GSystem
    const { count: removed } = await supabaseAdmin
      .from("gsystem_equipamentos")
      .delete({ count: "exact" })
      .lt("synced_at", runStart.toISOString());

    const finish = new Date().toISOString();
    await supabaseAdmin.from("gsystem_sync_status").upsert({
      id: "equipamentos",
      last_finished_at: finish,
      last_success_at: finish,
      items_count: total,
      last_error: null,
      updated_at: finish,
    });

    return { ok: true, itemsCount: total, removed: removed ?? 0 };
  } catch (e: any) {
    const msg = e?.message ? String(e.message) : String(e);
    await supabaseAdmin.from("gsystem_sync_status").upsert({
      id: "equipamentos",
      last_finished_at: new Date().toISOString(),
      last_error: msg.slice(0, 500),
      updated_at: new Date().toISOString(),
    });
    return { ok: false, itemsCount: 0, removed: 0, error: msg };
  }
}
