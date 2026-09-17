import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { TimelineContent } from "@/components/agenda/timeline-content";

export const Route = createFileRoute("/agenda/timeline")({
  head: () => ({
    meta: [
      { title: "Agenda — Timeline do dia | GSystem Hub" },
      { name: "description", content: "Timeline diária dos agendamentos do Seu Instalador por técnico e horário." },
      { property: "og:title", content: "Agenda — Timeline do dia | GSystem Hub" },
      { property: "og:description", content: "Veja a agenda do dia por técnico e horário." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TimelinePage,
});

function TimelinePage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <TimelineContent />
    </AppLayout>
  );
}
