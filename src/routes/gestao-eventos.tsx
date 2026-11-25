import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, Lock } from "lucide-react";
import { useAuth as useGestaoAuth } from "@/hooks/use-auth";
import { GeAuthProvider, useAuth } from "@/lib/ge/auth";
import { AppShell } from "@/components/ge/app-shell";

// Aplicações › Gestão de eventos (ex-"Gestão Telemetria e Fadiga").
// Equipe com o menu "gestao-eventos" entra como ADM da plataforma; usuários de clientes entram só aqui.
export const Route = createFileRoute("/gestao-eventos")({
  head: () => ({ meta: [{ title: "Gestão de eventos | Gestão Online" }] }),
  component: GestaoEventosLayout,
});

function GestaoEventosLayout() {
  const { isAuthenticated, isLoading } = useGestaoAuth();
  const navigate = useNavigate();
  useEffect(() => {
    if (!isLoading && !isAuthenticated) navigate({ to: "/", replace: true });
  }, [isLoading, isAuthenticated, navigate]);
  if (isLoading || !isAuthenticated) return null;
  return (
    <GeAuthProvider>
      <Portao />
    </GeAuthProvider>
  );
}

function Portao() {
  const { loading, isStaff, profile, roles } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  const temAcesso = isStaff || (!!profile?.is_active && roles.length > 0);
  if (!temAcesso) {
    return (
      <div className="max-w-md mx-auto mt-24 text-center space-y-2 p-4">
        <Lock className="h-8 w-8 mx-auto text-muted-foreground" />
        <h1 className="text-lg font-semibold">Acesso restrito</h1>
        <p className="text-sm text-muted-foreground">
          A Gestão de eventos é liberada para gestores, para os setores com o menu "Gestão de eventos" e para os usuários cadastrados dos clientes.
          Se a migração 0084 ainda não foi aplicada, peça ao administrador.
        </p>
      </div>
    );
  }
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  );
}
