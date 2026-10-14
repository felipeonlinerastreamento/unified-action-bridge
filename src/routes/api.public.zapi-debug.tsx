import { createFileRoute } from "@tanstack/react-router";

// TEMPORÁRIO: diagnóstico de redirecionamento da Z-API a partir do servidor.
export const Route = createFileRoute("/api/public/zapi-debug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("k");
        if (key !== "dbg-7f3a91") return new Response("no", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: channels } = await supabaseAdmin
          .from("channels")
          .select("id, name, token, zapi_instance_id, zapi_client_token, is_active")
          .not("zapi_instance_id", "is", null);
        const results: any[] = [];
        for (const data of channels ?? []) {
          const base = `https://api.z-api.io/instances/${data.zapi_instance_id}/token/${data.token}`;
          const sanitize = (s: string) =>
            s.split(data.token).join("TOKEN").split(String(data.zapi_instance_id)).join("INST");
          const variants: Array<{ name: string; path: string; method: string; ct: boolean; body?: string; signal?: boolean }> = [
            { name: "status-plain", path: "/status", method: "GET", ct: false },
            { name: "status-ct", path: "/status", method: "GET", ct: true },
            { name: "status-signal", path: "/status", method: "GET", ct: false, signal: true },
            { name: "status-ct-signal", path: "/status", method: "GET", ct: true, signal: true },
            { name: "send-ct", path: "/send-text", method: "POST", ct: true, body: "{}" },
            { name: "send-noct", path: "/send-text", method: "POST", ct: false, body: "{}" },
          ];
          const out: any[] = [];
          for (const v of variants) {
            const h: Record<string, string> = {};
            if (data.zapi_client_token) h["Client-Token"] = data.zapi_client_token;
            if (v.ct) h["Content-Type"] = "application/json";
            try {
              const r = await fetch(base + v.path, {
                method: v.method,
                headers: h,
                body: v.body,
                redirect: "manual",
                signal: v.signal ? AbortSignal.timeout(15000) : undefined,
              });
              out.push({
                v: v.name,
                status: r.status,
                location: sanitize(r.headers.get("location") || ""),
                cfRay: r.headers.get("cf-ray"),
                body: sanitize((await r.text()).slice(0, 120)),
              });
            } catch (e: any) {
              out.push({ v: v.name, error: sanitize(String(e?.message)).slice(0, 160) });
            }
          }
          results.push({ channel: data.name, active: data.is_active, hasClientToken: !!data.zapi_client_token, out });
        }
        return Response.json(results);
      },
    },
  },
});
