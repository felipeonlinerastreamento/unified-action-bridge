import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Somente estes usuários recebem notificações técnicas de falha de integração.
// A checagem é feita no servidor, a partir do token autenticado — o frontend
// não pode se autodeclarar autorizado.
const TECH_ALERT_EMAILS = ["davi@onlinerastreamento.com.br", "felipe@onlinerastreamento.com.br"]; // alertas técnicos de falha nas APIs

const STALE_MINUTES = 20;

export type SyncIssue = {
  clientName: string | null;
  apiType: string;
  message: string;
};

export const getSyncDiagnostics = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = String((context.claims as { email?: string }).email ?? "").toLowerCase();
    if (!TECH_ALERT_EMAILS.includes(email)) {
      return { authorized: false, issues: [] as SyncIssue[] };
    }

    const { geAdmin: supabaseAdmin } = await import("@/lib/ge/db.server");
    const { data, error } = await supabaseAdmin
      .from("ge_api_configurations")
      .select(
        "api_type, is_active, auto_sync_enabled, connection_status, error_message, last_sync_at, last_test_status, client_id, clients:ge_clients(name)",
      )
      .eq("is_active", true);

    if (error) {
      return {
        authorized: true,
        issues: [
          { clientName: null, apiType: "banco", message: `Falha ao consultar integrações: ${error.message}` },
        ],
      };
    }

    const issues: SyncIssue[] = [];
    const now = Date.now();
    for (const cfg of data ?? []) {
      const clientName = (cfg as { clients?: { name?: string } | null }).clients?.name ?? null;
      if (cfg.connection_status === "error" || cfg.last_test_status === "error") {
        issues.push({
          clientName,
          apiType: cfg.api_type,
          message: cfg.error_message ?? "Falha de comunicação com a API.",
        });
        continue;
      }
      if (cfg.auto_sync_enabled) {
        const last = cfg.last_sync_at ? new Date(cfg.last_sync_at).getTime() : null;
        if (last == null) {
          issues.push({ clientName, apiType: cfg.api_type, message: "Nenhuma sincronização registrada." });
        } else if (now - last > STALE_MINUTES * 60 * 1000) {
          const mins = Math.round((now - last) / 60000);
          issues.push({
            clientName,
            apiType: cfg.api_type,
            message: `Sem sincronização há ${mins} min (eventos podem estar atrasados).`,
          });
        }
      }
    }

    return { authorized: true, issues };
  });
