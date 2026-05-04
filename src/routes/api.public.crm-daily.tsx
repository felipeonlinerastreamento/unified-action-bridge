import { createFileRoute } from "@tanstack/react-router";
import { runCrmDailyJob } from "@/lib/crm-daily.server";

export const Route = createFileRoute("/api/public/crm-daily")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const summary = await runCrmDailyJob();
          return Response.json({ ok: true, summary });
        } catch (e: any) {
          console.error("crm-daily error:", e);
          return Response.json({ ok: false, error: e?.message || "error" }, { status: 500 });
        }
      },
      GET: async () => {
        try {
          const summary = await runCrmDailyJob();
          return Response.json({ ok: true, summary });
        } catch (e: any) {
          return Response.json({ ok: false, error: e?.message || "error" }, { status: 500 });
        }
      },
    },
  },
});
