import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { NoCommAutomationCard } from "@/components/settings/no-comm-automation-card";

export const Route = createFileRoute("/configuracoes/automacao-sem-comunicacao")({
  component: AutomacaoSemComunicacaoPage,
});

function AutomacaoSemComunicacaoPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Automação Sem Comunicação</h1>
          <p className="text-sm text-muted-foreground">
            Configure a detecção do comunicado de placas sem comunicação, o envio do rodapé com protocolo e a finalização automática do chamado.
          </p>
        </div>
        <NoCommAutomationCard />
      </div>
    </AppLayout>
  );
}
