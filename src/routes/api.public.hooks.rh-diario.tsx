import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Resumo diário do RH (férias vencendo, documentos, faltas, banco de horas, ausências pendentes).
 * Chamado pelo pg_cron (job "rh-avisos-diarios", 08:40) com o cabeçalho x-rh-cron-token
 * (tabela rh_cron_token) ou com o CRON_SECRET. Só envia se os avisos estiverem ligados no RH.
 */
async function tokenOk(request: Request): Promise<boolean> {
  const enviado = request.headers.get("x-rh-cron-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("rh_cron_token").select("token").eq("id", 1).maybeSingle();
  return safeEqual(enviado, data?.token);
}

export const Route = createFileRoute("/api/public/hooks/rh-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request) && !(await tokenOk(request))) return unauthorizedCronResponse();
        try {
          const { rotinaRh } = await import("@/lib/rh.server");
          const r = await rotinaRh({ manual: false });
          return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
