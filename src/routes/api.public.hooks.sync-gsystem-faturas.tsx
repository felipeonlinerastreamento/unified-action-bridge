import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Importa um lote de faturas do GSystem para o Financeiro.
 * Chamado pelo pg_cron (job "financeiro-faturas-gsystem", a cada 10 min) com o cabeçalho
 * x-fin-cron-token (token guardado em fin_cron_token, só legível pela service role),
 * ou por um agendador externo com o CRON_SECRET. Uma rodada nova começa no máximo 1x por hora;
 * uma rodada em andamento continua a cada chamada até passar por todos os clientes.
 */
async function tokenDoBancoOk(request: Request): Promise<boolean> {
  const enviado = request.headers.get("x-fin-cron-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("fin_cron_token").select("token").eq("id", 1).maybeSingle();
  return safeEqual(enviado, data?.token);
}

export const Route = createFileRoute("/api/public/hooks/sync-gsystem-faturas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request) && !(await tokenDoBancoOk(request))) return unauthorizedCronResponse();
        const { syncFaturasGsystem } = await import("@/lib/finance-gsystem-sync.server");
        const res = await syncFaturasGsystem(50_000, { minutosEntreRodadas: 55 });
        return new Response(JSON.stringify(res), {
          status: res.ok ? 200 : 500,
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
