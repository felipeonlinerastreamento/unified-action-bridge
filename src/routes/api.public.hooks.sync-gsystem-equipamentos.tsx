import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/hooks/sync-gsystem-equipamentos")({
  server: {
    handlers: {
      POST: async () => {
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
