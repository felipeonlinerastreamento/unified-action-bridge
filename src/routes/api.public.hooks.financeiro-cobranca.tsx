import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedCronRequest, safeEqual, unauthorizedCronResponse } from "@/lib/cron-auth.server";

/**
 * Régua de cobrança dos clientes (aba Inadimplência). Só envia se a régua estiver ligada.
 * Chamado pelo pg_cron (job "financeiro-cobranca", todo dia às 09:05) com o cabeçalho x-fin-cron-token
 * (o mesmo token do agendador das faturas, em fin_cron_token) ou com o CRON_SECRET.
 */
async function tokenOk(request: Request): Promise<boolean> {
  const enviado = request.headers.get("x-fin-cron-token");
  if (!enviado) return false;
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await (supabaseAdmin as any).from("fin_cron_token").select("token").eq("id", 1).maybeSingle();
  return safeEqual(enviado, data?.token);
}

export const Route = createFileRoute("/api/public/hooks/financeiro-cobranca")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedCronRequest(request) && !(await tokenOk(request))) return unauthorizedCronResponse();
        try {
          const { executarReguaCobranca } = await import("@/lib/finance-inadimplencia.server");
          const r = await executarReguaCobranca({ simular: false, manual: false });
          const { itens, ...resumo } = r as any;
          void itens;
          return new Response(JSON.stringify(resumo), { status: 200, headers: { "Content-Type": "application/json" } });
        } catch (e: any) {
          return new Response(JSON.stringify({ ok: false, error: String(e?.message ?? e) }), { status: 500, headers: { "Content-Type": "application/json" } });
        }
      },
    },
  },
});
