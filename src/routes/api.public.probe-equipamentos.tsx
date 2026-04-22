import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/probe-equipamentos")({
  server: {
    handlers: {
      GET: async () => {
        try {
          const { gsystemApiFetch } = await import("@/lib/gsystem-api.server");

          const ENDPOINTS_TO_TRY = [
            "/equipamentos", "/equipamento", "/Equipamentos", "/Equipamento",
            "/rastreadores", "/rastreador", "/Rastreadores", "/Rastreador",
            "/dispositivos", "/dispositivo", "/Dispositivos",
            "/aparelhos", "/aparelho", "/Aparelhos",
            "/produtos", "/Produtos",
            "/itens", "/Itens",
            "/chips", "/chip", "/Chips", "/Chip",
            "/sims", "/sim", "/Sims",
            "/simcards", "/SimCards", "/simcard",
            "/linhas", "/Linhas", "/linha",
            "/estoque", "/Estoque", "/estoques",
            "/almoxarifado", "/Almoxarifado",
            "/inventario", "/Inventario",
          ];

          const summarizeSample = (item: any) => {
            if (!item || typeof item !== "object") return null;
            const keys = Object.keys(item).slice(0, 25);
            const sample: Record<string, any> = {};
            for (const k of keys) {
              const v = (item as any)[k];
              if (v == null) sample[k] = null;
              else if (typeof v === "object") sample[k] = Array.isArray(v) ? `[array len=${v.length}]` : "{object}";
              else sample[k] = String(v).substring(0, 80);
            }
            return sample;
          };

          const results: any[] = [];
          for (const ep of ENDPOINTS_TO_TRY) {
            try {
              const result = await gsystemApiFetch(ep);
              if (Array.isArray(result)) {
                results.push({
                  endpoint: ep,
                  status: "ok",
                  count: result.length,
                  firstItemKeys: result.length > 0 ? Object.keys(result[0]).slice(0, 30) : [],
                  sample: result.length > 0 ? summarizeSample(result[0]) : null,
                });
              } else if (result && typeof result === "object") {
                const arr = (result as any).data ?? (result as any).Data ?? (result as any).Items
                  ?? (result as any).items ?? (result as any).resultado ?? (result as any).Result;
                if (Array.isArray(arr)) {
                  results.push({
                    endpoint: ep,
                    status: "ok-wrapped",
                    count: arr.length,
                    firstItemKeys: arr.length > 0 ? Object.keys(arr[0]).slice(0, 30) : [],
                    sample: arr.length > 0 ? summarizeSample(arr[0]) : null,
                  });
                } else {
                  results.push({ endpoint: ep, status: "object-no-array", keys: Object.keys(result).slice(0, 20) });
                }
              } else {
                results.push({ endpoint: ep, status: "empty-or-non-object" });
              }
            } catch (err: any) {
              const msg = String(err?.message || err);
              const m = msg.match(/\[(\d{3})\]/);
              results.push({ endpoint: ep, status: m ? `HTTP ${m[1]}` : msg.substring(0, 120) });
            }
          }

          let cadastrosByTipo: any[] = [];
          try {
            const cadastros = await gsystemApiFetch("/cadastros");
            if (Array.isArray(cadastros)) {
              const map = new Map<string, { count: number; first: any | null }>();
              for (const c of cadastros as any[]) {
                const t = String(c?.Tipo ?? "").trim();
                if (!t) continue;
                const cur = map.get(t) ?? { count: 0, first: null };
                cur.count += 1;
                if (!cur.first) cur.first = c;
                map.set(t, cur);
              }
              cadastrosByTipo = Array.from(map.entries())
                .map(([tipo, v]) => ({
                  tipo,
                  count: v.count,
                  sampleKeys: v.first ? Object.keys(v.first).slice(0, 25) : [],
                  sample: v.first ? summarizeSample(v.first) : null,
                }))
                .sort((a, b) => b.count - a.count);
            }
          } catch (err) {
            cadastrosByTipo = [{ error: String(err).substring(0, 200) }];
          }

          const successfulEndpoints = results.filter((r) => r.status?.startsWith("ok") && (r.count ?? 0) > 0);

          return new Response(
            JSON.stringify({
              probedAt: new Date().toISOString(),
              successfulEndpoints,
              endpoints: results,
              cadastrosByTipo,
            }, null, 2),
            { headers: { "content-type": "application/json" } }
          );
        } catch (err: any) {
          return new Response(
            JSON.stringify({ error: String(err?.message || err) }, null, 2),
            { status: 500, headers: { "content-type": "application/json" } }
          );
        }
      },
    },
  },
});
