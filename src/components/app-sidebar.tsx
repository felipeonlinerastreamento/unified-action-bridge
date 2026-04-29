import {
  LayoutDashboard,
  MessageSquare,
  Headphones,
  Users,
  Package,
  BarChart3,
  Settings,
  LogOut,
  Building2,
  UserPlus,
  Bot,
  MessageCircle,
  PhoneCall,
  Plug,
  ChevronDown,
  Boxes,
  UserCog,
  GitBranch,
  ArrowRightLeft,
  Sun,
  Moon,
  CheckSquare,
  List,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useTheme } from "@/hooks/use-theme";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarSeparator,
  useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

const mainItems = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  { title: "Chat", url: "/central", icon: Headphones },
  { title: "CRM", url: "/crm", icon: UserPlus },
  { title: "Contatos", url: "/contatos", icon: Users },
  { title: "Empresas", url: "/empresas", icon: Building2 },
  { title: "Estoque", url: "/estoque", icon: Boxes },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const atendimentosSubItems: { title: string; url: string; icon: typeof List }[] = [
  { title: "Lista", url: "/atendimentos", icon: List },
  // { title: "Tarefas", url: "/atendimentos/tarefas", icon: CheckSquare }, // inativado
];

const configSubItems = [
  { title: "Integrações", url: "/configuracoes", icon: Plug },
  { title: "Central de Atendimento", url: "/configuracoes/central-atendimento", icon: PhoneCall },
  { title: "Fluxo de Atendimento", url: "/configuracoes/fluxo-atendimento", icon: GitBranch },
  { title: "Estoque (Regras)", url: "/configuracoes/estoque", icon: Boxes },
  { title: "Assistente IA", url: "/configuracoes/assistente-ia", icon: Bot },
  { title: "Z-API & Bot", url: "/configuracoes/zapi", icon: MessageCircle },
  { title: "Encaminhamento", url: "/configuracoes/encaminhamento", icon: ArrowRightLeft },
  { title: "Usuários", url: "/configuracoes/usuarios", icon: UserCog },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const isConfigActive = location.pathname.startsWith("/configuracoes");
  const isAtendimentosActive = location.pathname.startsWith("/atendimentos");

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            GS
          </div>
          {!collapsed && (
            <span className="font-semibold text-sm">GSystem Hub</span>
          )}
        </div>
      </SidebarHeader>
      <SidebarSeparator />
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Menu</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {/* Dashboard primeiro */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={location.pathname.startsWith("/dashboard")}
                  tooltip="Dashboard"
                >
                  <Link to="/dashboard">
                    <LayoutDashboard className="h-4 w-4" />
                    <span>Dashboard</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Atendimentos (link direto) */}
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={isAtendimentosActive}
                  tooltip="Atendimentos"
                >
                  <Link to="/atendimentos">
                    <MessageSquare className="h-4 w-4" />
                    <span>Atendimentos</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>

              {/* Demais itens (pulando Dashboard) */}
              {mainItems.slice(1).map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Configurações com submenus */}
              <Collapsible defaultOpen={isConfigActive} className="group/collapsible">
                <SidebarMenuItem>
                  <CollapsibleTrigger asChild>
                    <SidebarMenuButton
                      isActive={isConfigActive}
                      tooltip="Configurações"
                    >
                      <Settings className="h-4 w-4" />
                      <span>Configurações</span>
                      <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                    </SidebarMenuButton>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    <SidebarMenuSub>
                      {configSubItems.map((sub) => (
                        <SidebarMenuSubItem key={sub.title}>
                          <SidebarMenuSubButton
                            asChild
                            isActive={location.pathname === sub.url}
                          >
                            <Link to={sub.url}>
                              <sub.icon className="h-3.5 w-3.5" />
                              <span>{sub.title}</span>
                            </Link>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      ))}
                    </SidebarMenuSub>
                  </CollapsibleContent>
                </SidebarMenuItem>
              </Collapsible>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <div className="flex items-center gap-1">
              <SidebarMenuButton onClick={signOut} tooltip="Sair" className="flex-1">
                <LogOut className="h-4 w-4" />
                <span>{profile?.name || "Sair"}</span>
              </SidebarMenuButton>
              {!collapsed && (
                <button
                  type="button"
                  onClick={toggleTheme}
                  aria-label={theme === "dark" ? "Ativar tema claro" : "Ativar tema escuro"}
                  title={theme === "dark" ? "Tema claro" : "Tema escuro"}
                  className="flex h-8 w-8 items-center justify-center rounded-md text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors shrink-0"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
              )}
            </div>
          </SidebarMenuItem>
          {collapsed && (
            <SidebarMenuItem>
              <SidebarMenuButton
                onClick={toggleTheme}
                tooltip={theme === "dark" ? "Tema claro" : "Tema escuro"}
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                <span>{theme === "dark" ? "Tema claro" : "Tema escuro"}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          )}
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
