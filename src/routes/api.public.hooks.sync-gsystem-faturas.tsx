import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/** Agendamento (mesmo CRON_SECRET da sync de equipamentos): importa um lote de faturas do GSystem para o Financeiro. */
export const Route = createFileRoute("/api/public/hooks/sync-gsystem-faturas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        const { syncFaturasGsystem } = await import("@/lib/finance-gsystem-sync.server");
        const res = await syncFaturasGsystem(50_000);
        return new Response(JSON.stringify(res), {
          status: res.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
