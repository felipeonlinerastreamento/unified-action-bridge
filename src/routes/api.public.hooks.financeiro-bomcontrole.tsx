import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Importação do Bom Controle em segundo plano: o pg_cron (job "financeiro-bomcontrole", a cada minuto,
 * só enquanto há importação ativa) chama este hook com o cabeçalho x-fin-cron-token.
 */
async function tokenOk(request: Request): Promise<boolean> {
  const enviado = request.headers.get("x-fin-cron-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("fin_cron_token").select("token").eq("id", 1).maybeSingle();
  return safeEqual(enviado, data?.token);
}

export const Route = createFileRoute("/api/public/hooks/financeiro-bomcontrole")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request) && !(await tokenOk(request))) return unauthorizedCronResponse();
        try {
          const { rodadaBomControle } = await import("@/lib/finance-bomcontrole.server");
          const r = await rodadaBomControle(45_000);
          return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
