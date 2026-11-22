import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Lê a caixa financeiro@ (cobranças, notas e boletos de fornecedores) e lança no contas a pagar.
 * Chamado pelo pg_cron (job "financeiro-email", a cada 30 min) com o cabeçalho x-fin-cron-token
 * (o mesmo token do agendador das faturas, em fin_cron_token) ou com o CRON_SECRET.
 */
async function tokenOk(request: Request): Promise<boolean> {
  const enviado = request.headers.get("x-fin-cron-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("fin_cron_token").select("token").eq("id", 1).maybeSingle();
  return safeEqual(enviado, data?.token);
}

export const Route = createFileRoute("/api/public/hooks/financeiro-email")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request) && !(await tokenOk(request))) return unauthorizedCronResponse();
        try {
          const { lerEmailFinanceiro } = await import("@/lib/finance-fornecedores.server");
          const r = await lerEmailFinanceiro(50_000);
          return new Response(JSON.stringify(r), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
