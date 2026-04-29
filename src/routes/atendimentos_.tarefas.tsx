import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { TarefasContent } from "@/components/tarefas/tarefas-content";

export const Route = createFileRoute("/atendimentos_/tarefas")({
  component: TarefasPage,
});

function TarefasPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <TarefasContent />
    </AppLayout>
  );
}
