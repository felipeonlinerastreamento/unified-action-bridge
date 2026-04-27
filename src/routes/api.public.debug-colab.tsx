import { createFileRoute } from "@tanstack/react-router";
import { gsystemApiFetch } from "@/lib/gsystem-api.server";

export const Route = createFileRoute("/api/public/debug-colab")({
  server: {
    handlers: {
      GET: async () => {
        const out: Record<string, any> = {};
        const endpoints = [
          "/colaboradores",
          "/Colaboradores",
          "/usuarios",
          "/Usuarios",
          "/Funcionarios",
          "/funcionarios",
          "/pendencias",
        ];
        for (const ep of endpoints) {
          try {
            const data = await gsystemApiFetch(ep, "GET");
            const sample = Array.isArray(data) ? data.slice(0, 1) : data;
            out[ep] = {
              ok: true,
              isArray: Array.isArray(data),
              count: Array.isArray(data) ? data.length : (data?.Items?.length ?? "n/a"),
              sample: JSON.stringify(sample).substring(0, 1500),
            };
          } catch (e: any) {
            out[ep] = { ok: false, error: String(e?.message || e).substring(0, 400) };
          }
        }
        return new Response(JSON.stringify(out, null, 2), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
