import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Rotina diária de Contratos (lembretes de assinatura, avisos de vencimento e reajuste, índices).
 * Chamada pelo pg_cron (job "contratos-rotina-diaria", 08:20 em São Paulo) com o cabeçalho
 * x-contratos-cron-token (guardado em contratos_cron_token, só a service role lê) ou com o CRON_SECRET.
 */
async function tokenOk(request: Request): Promise<boolean> {
  const enviado = request.headers.get("x-contratos-cron-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("contratos_cron_token").select("token").eq("id", 1).maybeSingle();
  return safeEqual(enviado, data?.token);
}

export const Route = createFileRoute("/api/public/hooks/contratos-diario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request) && !(await tokenOk(request))) return unauthorizedCronResponse();
        try {
          const { rotinaDiariaContratos } = await import("@/lib/contratos-automacao.server");
          const r = await rotinaDiariaContratos();
          return new Response(JSON.stringify({ ok: true, ...r }), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
