import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Bot } from "lucide-react";
import { ZapiConnectionConfig } from "@/components/configuracoes/zapi-connection-config";
import { ZapiBotFlowEditor } from "@/components/configuracoes/zapi-bot-flow-editor";
import { ZapiQuickRepliesConfig } from "@/components/configuracoes/zapi-quick-replies-config";
import { ZapiMessageTemplatesConfig } from "@/components/configuracoes/zapi-message-templates-config";
import { BusinessHoursForm } from "@/components/configuracoes/business-hours-form";

export const Route = createFileRoute("/configuracoes/zapi")({
  component: ZapiPage,
});

function ZapiPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const allowed = hasRole("admin") || hasRole("gestor");

  if (isLoading || !isAuthenticated) return null;
  if (!allowed) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito a administradores e gestores.</p>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bot className="h-6 w-6" /> Z-API & Bot
          </h1>
          <p className="text-sm text-muted-foreground">
            Conexão WhatsApp via Z-API, fluxo do bot de menu, respostas rápidas e modo de operação.
          </p>
        </div>

        <ZapiConnectionConfig />
        <BusinessHoursForm />
        <ZapiBotFlowEditor />
        <ZapiMessageTemplatesConfig />
        <ZapiQuickRepliesConfig />
      </div>
    </AppLayout>
  );
}
