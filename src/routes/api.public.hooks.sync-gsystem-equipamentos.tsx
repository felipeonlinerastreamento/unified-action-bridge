import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, unauthorizedCronResponse } from "@/lib/cron-auth.server";

export const Route = createFileRoute("/api/public/hooks/sync-gsystem-equipamentos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request)) return unauthorizedCronResponse();
        const { syncGsystemEquipamentos } = await import(
          "@/lib/gsystem-equipamentos-sync.server"
        );
        const res = await syncGsystemEquipamentos();
        return new Response(JSON.stringify(res), {
          status: res.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
