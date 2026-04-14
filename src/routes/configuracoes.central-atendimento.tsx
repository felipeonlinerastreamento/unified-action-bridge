import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SlaRulesConfig } from "@/components/configuracoes/sla-rules-config";
import { AlertSettingsConfig } from "@/components/configuracoes/alert-settings-config";
import { MetricSettingsConfig } from "@/components/configuracoes/metric-settings-config";
import { VisualSettingsConfig } from "@/components/configuracoes/visual-settings-config";

export const Route = createFileRoute("/configuracoes/central-atendimento")({
  component: CentralAtendimentoConfigPage,
});

function CentralAtendimentoConfigPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Central de Atendimento</h1>
          <p className="text-sm text-muted-foreground">Configurações de SLA, alertas, métricas e visual do chat</p>
        </div>

        <Tabs defaultValue="sla">
          <TabsList>
            <TabsTrigger value="sla">SLAs por Setor</TabsTrigger>
            <TabsTrigger value="alerts">Alertas e Escalonamento</TabsTrigger>
            <TabsTrigger value="metrics">Indicadores Operacionais</TabsTrigger>
            <TabsTrigger value="visual">Visual do Chat</TabsTrigger>
          </TabsList>

          <TabsContent value="sla" className="mt-4">
            <SlaRulesConfig />
          </TabsContent>
          <TabsContent value="alerts" className="mt-4">
            <AlertSettingsConfig />
          </TabsContent>
          <TabsContent value="metrics" className="mt-4">
            <MetricSettingsConfig />
          </TabsContent>
          <TabsContent value="visual" className="mt-4">
            <VisualSettingsConfig />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
