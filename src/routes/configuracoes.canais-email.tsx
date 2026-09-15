import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { EmailChannelsConfig } from "@/components/configuracoes/email-channels-config";

export const Route = createFileRoute("/configuracoes/canais-email")({
  component: CanaisEmailRoute,
});

function CanaisEmailRoute() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();

  if (isLoading || !isAuthenticated) return null;

  if (!hasRole("admin") && !hasRole("gestor")) {
    return (
      <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
        Acesso restrito a administradores e gestores.
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          Integração de E-mail (Office 365)
        </h2>
        <p className="text-muted-foreground">
          Adicione contas de e-mail do Outlook para abrir atendimentos automaticamente na fila ao receber novas mensagens.
        </p>
      </div>
      <EmailChannelsConfig />
    </div>
  );
}
