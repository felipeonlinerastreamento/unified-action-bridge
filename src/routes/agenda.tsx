import { createFileRoute, Outlet, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { canAccessAgendaPath } from "@/lib/menu-catalog";
import { AppLayout } from "@/components/app-layout";

export const Route = createFileRoute("/agenda")({
  component: AgendaLayout,
});

function AgendaLayout() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading, canSeeMenu } = useUserPermissions();
  const { pathname } = useLocation();
  if (authLoading || isLoading || !isAuthenticated) return null;
  if (pathname !== "/agenda" && pathname !== "/agenda/" && !canAccessAgendaPath(pathname, canSeeMenu)) {
    return <AppLayout><h1 className="text-xl font-semibold">Acesso não autorizado</h1><p className="mt-2 text-muted-foreground">Este submenu da Agenda não está liberado para seu grupo.</p></AppLayout>;
  }
  return <Outlet />;
}
