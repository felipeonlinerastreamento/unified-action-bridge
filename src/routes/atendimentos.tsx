import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { AtendimentosContent } from "@/components/atendimentos/atendimentos-content";

export const Route = createFileRoute("/atendimentos")({
  head: () => ({ meta: [
    { title: "Atendimentos | GSystem Hub" },
    { name: "description", content: "Gerencie chamados, comentários e respostas por e-mail no GSystem Hub." },
    { property: "og:title", content: "Atendimentos | GSystem Hub" },
    { property: "og:description", content: "Acompanhe chamados e conversas da equipe no GSystem Hub." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: AtendimentosPage,
  validateSearch: (s: Record<string, unknown>): { ticket?: string } => ({
    ticket: typeof s.ticket === "string" ? s.ticket : undefined,
  }),
});

function AtendimentosPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { ticket } = Route.useSearch();
  if (authLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <AtendimentosContent autoOpenTicketId={ticket} />
    </AppLayout>
  );
}
