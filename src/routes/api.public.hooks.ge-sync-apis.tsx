import { createFileRoute } from "@tanstack/react-router";
import { safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Gestão de eventos: busca os eventos nas APIs (Movias/YUV) a cada minuto.
 * Chamado pelo pg_cron "ge-sync-apis" com o cabeçalho x-ge-cron-token. Só roda depois da
 * virada (ge_migracao.sync_ativo), para não buscar em paralelo com o sistema antigo.
 */
export const Route = createFileRoute("/api/public/hooks/ge-sync-apis")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { geAdmin } = await import("@/lib/ge/db.server");
        const db = geAdmin as any;
        const { data: tk } = await db.from("ge_cron_token").select("token").eq("id", 1).maybeSingle();
        if (!safeEqual(request.headers.get("x-ge-cron-token") ?? "", tk?.token)) return unauthorizedCronResponse();
        const { data: mig } = await db.from("ge_migracao").select("sync_ativo").eq("id", 1).maybeSingle();
        if (!mig?.sync_ativo) return Response.json({ ok: true, pulado: "sincronização ainda não ativada (virada do sistema antigo)" });

        const { data: configs, error } = await geAdmin
          .from("ge_api_configurations")
          .select("id, api_type, base_url, username, password_encrypted, bearer_token_encrypted, api_key_encrypted, events_endpoint, client_id, last_sync_at, sync_device_cursor, sync_devices_cache, sync_devices_cache_at")
          .eq("is_active", true)
          .eq("auto_sync_enabled", true);
        if (error) return Response.json({ ok: false, error: error.message }, { status: 500 });

        const { runSyncForConfig } = await import("@/lib/ge/api-sync.server");
        const results: unknown[] = [];
        for (const cfg of configs ?? []) {
          try {
            const r = await runSyncForConfig(cfg);
            results.push({ configId: cfg.id, apiType: cfg.api_type, inserted: r.inserted, updated: r.updated, storedUnmatched: r.storedUnmatched, errorMessage: r.errorMessage });
          } catch (e) {
            results.push({ configId: cfg.id, apiType: cfg.api_type, errorMessage: e instanceof Error ? e.message : String(e) });
          }
        }
        return Response.json({ ok: true, count: results.length, results });
      },
    },
  },
});
