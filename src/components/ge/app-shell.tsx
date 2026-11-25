import { Link, useNavigate, useLocation } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { useAuth } from "@/lib/ge/auth";
import { FEATURES, useFeatures, type FeatureKey } from "@/lib/ge/features";
import {
  AlertTriangle,
  FileText,
  Settings,
  Users,
  Plug,
  Sliders,
  Bell,
  LogOut,
  Shield,
  Building2,
  UserCircle,
  Truck,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface NavItem {
  to: string;
  label: string;
  icon: typeof AlertTriangle;
  platformOnly?: boolean;
  feature?: FeatureKey;
}

const mainNav: NavItem[] = [
  { to: "/gestao-eventos/eventos", label: "Eventos", icon: AlertTriangle, feature: FEATURES.events },
  { to: "/gestao-eventos/frotas", label: "Frotas", icon: Truck, feature: FEATURES.fleets },
  { to: "/gestao-eventos/relatorio", label: "Relatório Operacional", icon: FileText, feature: FEATURES.reportsOperational },
];

const adminNav: NavItem[] = [
  { to: "/gestao-eventos/admin/apis", label: "APIs", icon: Plug, platformOnly: true },
  { to: "/gestao-eventos/admin/importacao", label: "Importar do sistema antigo", icon: Upload, platformOnly: true },
  { to: "/gestao-eventos/admin/unmatched-events", label: "Eventos órfãos", icon: AlertTriangle, platformOnly: true },
  { to: "/gestao-eventos/admin/clients", label: "Clientes", icon: Building2, platformOnly: true },
  { to: "/gestao-eventos/admin/groups", label: "Grupos", icon: Building2, platformOnly: true },
  { to: "/gestao-eventos/admin/fleets", label: "Frotas do Cliente", icon: Truck, feature: FEATURES.fleets },
  { to: "/gestao-eventos/admin/users", label: "Usuários", icon: Users },
  { to: "/gestao-eventos/admin/drivers", label: "Motoristas", icon: UserCircle, feature: FEATURES.drivers },
  { to: "/gestao-eventos/admin/risk-config", label: "Categorização de Risco", icon: Sliders, feature: FEATURES.risk },
  { to: "/gestao-eventos/admin/notifications", label: "Notificações", icon: Bell },
];


export function AppShell({ children }: { children: ReactNode }) {
  const { profile, signOut, isPlatformAdmin, isClientAdmin, roles, impersonatedClient, stopImpersonation, isStaff } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { has: hasFeature } = useFeatures();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/" });
  };

  const showAdmin = isPlatformAdmin || isClientAdmin;
  const insideClient = Boolean(impersonatedClient) || (!isPlatformAdmin && Boolean(profile?.client_id));
  const clientHiddenPaths = ["/gestao-eventos/admin/importacao", "/gestao-eventos/admin/clients", "/gestao-eventos/admin/groups", "/gestao-eventos/admin/users", "/gestao-eventos/admin/apis", "/gestao-eventos/admin/unmatched-events"];
  const featureAllowed = (item: NavItem) => !item.feature || hasFeature(item.feature);
  const visibleMainNav = mainNav.filter(featureAllowed);
  const visibleAdminNav = adminNav.filter(
    (item) =>
      (!item.platformOnly || isPlatformAdmin) &&
      !(insideClient && clientHiddenPaths.includes(item.to)) &&
      featureAllowed(item),
  );


  return (
    <div className="flex min-h-screen bg-background">
      <aside className="hidden w-64 flex-col border-r bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex h-16 items-center gap-2 border-b border-sidebar-border px-4">
          <Shield className="h-5 w-5 text-sidebar-primary" />
          <span className="font-semibold">Gestão de eventos</span>
        </div>
        {isStaff && (
          <Link to="/dashboard" className="mx-3 mt-3 rounded-md border border-sidebar-border px-3 py-1.5 text-xs text-sidebar-foreground/80 hover:bg-sidebar-accent">
            ← Voltar ao Gestão Online
          </Link>
        )}
        <nav className="flex-1 space-y-1 p-3">
          {visibleMainNav.map((item) => (
            <NavLink key={item.to} item={item} active={location.pathname.startsWith(item.to)} />
          ))}
          {showAdmin && visibleAdminNav.length > 0 && (
            <>
              <div className="mt-6 mb-1 px-3 text-xs font-medium uppercase text-sidebar-foreground/50">
                <Settings className="mr-1 inline h-3 w-3" /> Admin
              </div>
              {visibleAdminNav.map((item) => (
                <NavLink key={item.to} item={item} active={location.pathname.startsWith(item.to)} />
              ))}
            </>
          )}
        </nav>
        <div className="border-t border-sidebar-border p-3">
          <div className="mb-2 px-2 text-sm">
            <div className="truncate font-medium">{profile?.full_name || profile?.email}</div>
            <div className="truncate text-xs text-sidebar-foreground/60">
              {isStaff ? "Equipe Online Rastreamento" : roles.length > 0 ? roles.map(roleLabel).join(", ") : "Sem papel"}
            </div>
          </div>
          {!isStaff && (
            <Button variant="ghost" size="sm" className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground" onClick={handleSignOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          )}
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden">
        {/* Celular: o menu lateral some, então os itens viram uma faixa rolável no topo. */}
        <nav className="flex gap-1 overflow-x-auto border-b bg-sidebar p-2 md:hidden">
          {isStaff && <Link to="/dashboard" className="shrink-0 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/80">← Gestão</Link>}
          {[...visibleMainNav, ...(showAdmin ? visibleAdminNav : [])].map((item) => (
            <Link key={item.to} to={item.to} className={cn("shrink-0 rounded-md px-3 py-1.5 text-xs", location.pathname.startsWith(item.to) ? "bg-sidebar-primary text-sidebar-primary-foreground" : "text-sidebar-foreground/80")}>
              {item.label}
            </Link>
          ))}
          {!isStaff && <button onClick={handleSignOut} className="shrink-0 rounded-md px-3 py-1.5 text-xs text-sidebar-foreground/80">Sair</button>}
        </nav>
        {impersonatedClient && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-amber-500/15 px-6 py-2 text-sm">
            <span>
              <strong>Acesso remoto (manutenção)</strong> — visualizando a base de{" "}
              <strong>{impersonatedClient.name}</strong>
            </span>
            <Button size="sm" variant="outline" onClick={stopImpersonation}>
              Sair do acesso remoto
            </Button>
          </div>
        )}
        <div className="mx-auto max-w-7xl p-6">{children}</div>
      </main>

    </div>
  );
}

function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      to={item.to}
      className={cn(
        "flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors",
        active
          ? "bg-sidebar-primary text-sidebar-primary-foreground"
          : "text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
      )}
    >
      <Icon className="h-4 w-4" />
      {item.label}
    </Link>
  );
}

function roleLabel(r: string) {
  switch (r) {
    case "admin_platform": return "Admin Plataforma";
    case "admin_client": return "Admin Cliente";
    case "operator": return "Operador";
    default: return r;
  }
}
