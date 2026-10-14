import { createFileRoute } from "@tanstack/react-router";

// TEMPORÁRIO: diagnóstico de redirecionamento da Z-API a partir do servidor.
export const Route = createFileRoute("/api/public/zapi-debug")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const key = new URL(request.url).searchParams.get("k");
        if (key !== "dbg-7f3a91") return new Response("no", { status: 404 });
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data } = await supabaseAdmin
          .from("channels")
          .select("id, token, zapi_instance_id, zapi_client_token")
          .not("zapi_instance_id", "is", null)
          .limit(1)
          .single();
        if (!data) return Response.json({ err: "no channel" });
        const url = `https://api.z-api.io/instances/${data.zapi_instance_id}/token/${data.token}/status`;
        const out: any[] = [];
        for (const variant of ["plain", "ua"]) {
          const h: Record<string, string> = {};
          if (data.zapi_client_token) h["Client-Token"] = data.zapi_client_token;
          if (variant === "ua") {
            h["User-Agent"] = "Mozilla/5.0 GSHub";
            h["Accept"] = "application/json";
          }
          try {
            const r = await fetch(url, { headers: h, redirect: "manual" });
            const loc = r.headers.get("location") || "";
            out.push({
              variant,
              status: r.status,
              location: loc.replace(data.token, "TOKEN").replace(data.zapi_instance_id!, "INST"),
              sameUrl: loc === url,
              setCookie: !!r.headers.get("set-cookie"),
              headers: [...r.headers.keys()],
              server: r.headers.get("server"),
              body: (await r.text()).slice(0, 200),
            });
          } catch (e: any) {
            out.push({ variant, error: String(e?.message).slice(0, 200) });
          }
        }
        return Response.json(out);
      },
    },
  },
});
