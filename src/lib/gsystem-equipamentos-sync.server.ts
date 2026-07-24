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

/**
 * Retry wrapper para /equipamentos: API do GSystem costuma retornar 524/timeout
 * quando páginas grandes demoram. Fazemos backoff em 429/5xx e erros de rede.
 */
async function fetchEquipamentosWithRetry(qs: string, maxAttempts = 4): Promise<any> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await gsystemApiFetch(`/equipamentos?${qs}`, "GET");
    } catch (e: any) {
      lastErr = e;
      const msg = String(e?.message ?? e);
      const m = msg.match(/GSystem API error \[(\d+)\]/);
      const status = m ? Number(m[1]) : 0;
      const retriable = status === 0 || status === 429 || status === 502 || status === 503 || status === 504 || status === 524;
      if (!retriable || attempt === maxAttempts) throw e;
      const wait = Math.min(30000, 2000 * Math.pow(2, attempt - 1)); // 2s,4s,8s
      console.warn(`[sync equipamentos] tentativa ${attempt} falhou (${status || "network"}), retry em ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw lastErr;
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
      qs.set("Limit", "100");
      if (cursor) qs.set("Cursor", cursor);
      const res: any = await fetchEquipamentosWithRetry(qs.toString());

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
