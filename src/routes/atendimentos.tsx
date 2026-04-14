import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { AtendimentosContent } from "@/components/atendimentos/atendimentos-content";

export const Route = createFileRoute("/atendimentos")({
  component: AtendimentosPage,
});

function AtendimentosPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  if (authLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <AtendimentosContent />
    </AppLayout>
  );
}
