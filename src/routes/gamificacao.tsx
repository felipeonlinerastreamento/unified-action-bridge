import { createFileRoute, Link, Outlet, useLocation } from "@tanstack/react-router";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { canSeeGamification } from "@/lib/gamif-rules";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/gamificacao")({
  head: () => ({
    meta: [
      { title: "Gamificação | GS Hub" },
      { name: "description", content: "AtentaCoins, XP, rankings, missões e loja de recompensas da equipe." },
      { property: "og:title", content: "Gamificação | GS Hub" },
      { property: "og:description", content: "Rankings, missões e recompensas da equipe no GS Hub." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: GamifLayout,
});

const tabs = [
  { to: "/gamificacao", label: "Dashboard" },
  { to: "/gamificacao/rankings", label: "Rankings" },
  { to: "/gamificacao/missoes", label: "Missões" },
  { to: "/gamificacao/loja", label: "Loja" },
  { to: "/gamificacao/historico", label: "Histórico" },
  { to: "/gamificacao/sugestoes", label: "Sugestões" },
] as const;

function GamifLayout() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const { pathname } = useLocation();
  if (isLoading || !isAuthenticated) return null;
  const isManager = hasRole("admin") || hasRole("gestor");
  if (!canSeeGamification({ isAdmin: hasRole("admin") })) {
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
        <div>
          <h1 className="text-2xl font-bold">Gamificação</h1>
          <p className="text-sm text-muted-foreground">AtentaCoins, XP, missões e recompensas.</p>
        </div>
        <nav className="flex flex-wrap gap-1 border-b">
          {all.map((t) => {
            const active = t.to === "/gamificacao" ? pathname.replace(/\/$/, "") === "/gamificacao" : pathname.startsWith(t.to);
            return (
              <Link key={t.to} to={t.to} className={cn("px-3 py-2 text-sm border-b-2 -mb-px", active ? "border-primary text-foreground font-medium" : "border-transparent text-muted-foreground hover:text-foreground")}>
                {t.label}
              </Link>
            );
          })}
        </nav>
        <Outlet />
      </div>
    </AppLayout>
  );
}
