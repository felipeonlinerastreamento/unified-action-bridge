import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { AtividadesContent } from "@/components/agenda/atividades-content";

export const Route = createFileRoute("/agenda/atividades")({
  head: () => ({
    meta: [
      { title: "Agenda — Atividades | Gestão Online" },
      { name: "description", content: "Atividades agendadas no Seu Instalador por período, status, cliente e técnico." },
      { property: "og:title", content: "Agenda — Atividades | Gestão Online" },
      { property: "og:description", content: "Consulte e agende atividades da rede de instaladores." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AtividadesPage,
});

function AtividadesPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <AtividadesContent />
    </AppLayout>
  );
}
