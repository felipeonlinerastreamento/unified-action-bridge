import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { FlowList } from "@/components/fluxo-atendimento/flow-list";
import { FlowStepEditor } from "@/components/fluxo-atendimento/flow-step-editor";
import { GitBranch } from "lucide-react";

export const Route = createFileRoute("/configuracoes/fluxo-atendimento")({
  component: FluxoAtendimentoPage,
});

type SelectedFlow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

function FluxoAtendimentoPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const isAdminOrGestor = hasRole("admin") || hasRole("gestor");
  const [selectedFlow, setSelectedFlow] = useState<SelectedFlow | null>(null);

  if (isLoading || !isAuthenticated) return null;

  if (!isAdminOrGestor) {
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
            <GitBranch className="h-6 w-6" /> Fluxo de Atendimento
          </h1>
          <p className="text-sm text-muted-foreground">
            Configure jornadas operacionais, roteamento entre setores, regras de transição e permissões de finalização.
          </p>
        </div>

        <FlowList onSelectFlow={setSelectedFlow} selectedFlowId={selectedFlow?.id} />

        {selectedFlow && (
          <FlowStepEditor flowId={selectedFlow.id} flowName={selectedFlow.name} />
        )}
      </div>
    </AppLayout>
  );
}
