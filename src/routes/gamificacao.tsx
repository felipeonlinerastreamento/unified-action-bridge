import { useEffect } from "react";
import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { canSeeGamification } from "@/lib/gamif-rules";
import { useMyRoles, useMyUserId, useUnreadNotifications } from "@/components/gamificacao/gamif-data";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gamificacao")({
  head: () => ({
    meta: [
      { title: "Gamificação | Gestão Online" },
      { name: "description", content: "AtentaCoins, XP, rankings, missões e loja de recompensas da equipe." },
      { property: "og:title", content: "Gamificação | Gestão Online" },
      { property: "og:description", content: "Rankings, missões e recompensas da equipe no Gestão Online." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamifLayout,
});

const tabs = [
  { to: "/gamificacao", label: "Dashboard" },
  { to: "/gamificacao/feed", label: "Feed" },
  { to: "/gamificacao/rankings", label: "Rankings" },
  { to: "/gamificacao/missoes", label: "Missões" },
  { to: "/gamificacao/duelos", label: "Duelos" },
  { to: "/gamificacao/loja", label: "Loja" },
  { to: "/gamificacao/historico", label: "Histórico" },
  { to: "/gamificacao/metricas", label: "Métricas" },
  { to: "/gamificacao/processos", label: "Processos" },
  { to: "/gamificacao/sugestoes", label: "Sugestões" },
  { to: "/gamificacao/notificacoes", label: "Notificações" },
  { to: "/gamificacao/perfil", label: "Perfil" },
] as const;

function GamifLayout() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <AppLayout><GamifLoading /></AppLayout>;
  if (!isAuthenticated) return null;
  return <GamifShell />;
}

function GamifLoading() {
  return (
    <div className="space-y-4 p-4 md:p-6" aria-busy="true">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-10 w-full" />
      <div className="grid gap-4 md:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
    </div>
  );
}

function GamifShell() {
  const { pathname } = useLocation();
  const qc = useQueryClient();
  const { data: roles, isLoading: rolesLoading } = useMyRoles();
  const { data: me } = useMyUserId();
  const { data: unread = 0 } = useUnreadNotifications(me);

  // Avisos agendados já vencidos são entregues quando alguém abre a Gamificação.
  useEffect(() => {
    supabase.rpc("gamif_dispatch_scheduled_notifications").then(({ data }) => {
      if (data && data > 0) qc.invalidateQueries({ queryKey: ["gamif-unread"] });
    });
  }, [qc]);

  if (rolesLoading || !roles) return <AppLayout><GamifLoading /></AppLayout>;
  const isAdmin = roles.includes("admin");
  const isManager = isAdmin || roles.includes("gestor");
  if (!canSeeGamification({ isAdmin })) {
    return (
      <AppLayout>
        <div className="p-8 text-muted-foreground">A Gamificação ainda não foi liberada para seu usuário.</div>
      </AppLayout>
    );
  }
  const all = isManager ? [...tabs, { to: "/gamificacao/admin", label: "Admin" } as const] : tabs;
  return (
    <AppLayout>
      <div className="space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold">Gamificação</h1>
            <p className="text-sm text-muted-foreground">AtentaCoins, XP, missões e recompensas.</p>
          </div>
          <div className="flex gap-3 text-sm">
            <Link to="/atendimentos/tarefas" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Tarefas</Link>
            <Link to="/assistente-ia" className="text-muted-foreground hover:text-foreground underline-offset-4 hover:underline">Assistente IA</Link>
          </div>
        </div>
        <nav className="flex flex-wrap gap-1 border-b">
          {all.map((t) => {
            const active = t.to === "/gamificacao" ? pathname.replace(/\/$/, "") === "/gamificacao" : pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={cn("flex items-center gap-1 px-3 py-2 text-sm border-b-2 -mb-px", active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
                {t.to === "/gamificacao/notificacoes" && unread > 0 && (
                  <span className="rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">{unread > 99 ? "99+" : unread}</span>
                )}
              </Link>
            );
          })}
        </nav>
        <Outlet />
      </div>
    </AppLayout>
  );
}
