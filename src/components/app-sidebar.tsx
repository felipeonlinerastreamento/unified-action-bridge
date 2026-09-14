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
  Bell,
  Activity,
  ShieldCheck,
  Megaphone,
  FileText,
  Monitor,
} from "lucide-react";


import { Link, useLocation } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { URL_TO_MENU_SLUG } from "@/lib/menu-catalog";
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
  
  { title: "Chat com Operadores", url: "/chat-operadores", icon: MessageCircle },
  { title: "Painel TV", url: "/painel-tv", icon: Monitor },
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
  { title: "Automação Sem Comunicação", url: "/configuracoes/automacao-sem-comunicacao", icon: Megaphone },
  { title: "Popup Diário", url: "/configuracoes/popup-diario", icon: Sun },
  { title: "Usuários", url: "/configuracoes/usuarios", icon: UserCog },
  { title: "Status de Usuários", url: "/configuracoes/status-usuarios", icon: Activity },
  { title: "Notificações", url: "/configuracoes/notificacoes", icon: Bell },
  { title: "Auditoria", url: "/configuracoes/auditoria", icon: ShieldCheck },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut, hasRole } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { canSeeMenu } = useUserPermissions();
  const isAdmin = hasRole("admin");
  const isGestor = hasRole("gestor");
  const canAudit = isAdmin || isGestor;

  const [userId, setUserId] = useState<string | null>(null);
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  // Conversas sem resposta (com mensagens não lidas) atribuídas a mim ou sem
  // responsável nos meus setores — exibidas como selo no item "Chat".
  const { data: unansweredChats = 0 } = useQuery({
    queryKey: ["sidebar-unanswered-chats", userId],
    enabled: !!userId,
    refetchInterval: 15000,
    queryFn: async () => {
      if (!userId) return 0;
      const { data: links } = await supabase
        .from("user_sector_assignments")
        .select("sector_id")
        .eq("user_id", userId);
      const sectorIds = (links || []).map((l) => l.sector_id);
      let sectorNames: string[] = [];
      if (sectorIds.length > 0) {
        const { data: secs } = await supabase
          .from("sectors")
          .select("name")
          .in("id", sectorIds);
        sectorNames = (secs || []).map((s) => s.name);
      }
      let total = 0;
      const { count: mine } = await supabase
        .from("zapi_chats")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", userId)
        .gt("unread_count", 0)
        .neq("status", "finalizado");
      total += mine || 0;
      if (sectorNames.length > 0) {
        const { count: sectorOpen } = await supabase
          .from("zapi_chats")
          .select("id", { count: "exact", head: true })
          .is("assigned_to", null)
          .gt("unread_count", 0)
          .neq("status", "finalizado")
          .in("sector_name", sectorNames);
        total += sectorOpen || 0;
      }
      return total;
    },
  });

  const isConfigActive = location.pathname.startsWith("/configuracoes");
  const isAtendimentosActive = location.pathname.startsWith("/atendimentos");

  const canSeeUrl = (url: string) => {
    const slug = URL_TO_MENU_SLUG[url];
    if (!slug) return true;
    return canSeeMenu(slug);
  };

  const visibleConfigItems = configSubItems.filter((sub) => canSeeUrl(sub.url));
  const showConfigMenu = isAdmin || visibleConfigItems.length > 0;



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
              {canSeeUrl("/dashboard") && (
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
              )}

              {/* Atendimentos (link direto) */}
              {canSeeUrl("/atendimentos") && (
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
              )}

              {/* Demais itens (pulando Dashboard) */}
              {mainItems.slice(1)
                .filter((item) => canSeeUrl(item.url))
                .map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname.startsWith(item.url)}
                    tooltip={item.title}
                  >
                    <Link to={item.url}>
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                      {item.url === "/central" && unansweredChats > 0 && (
                        <Badge className="ml-auto h-5 min-w-[20px] px-1 bg-red-600 text-white text-[11px] font-bold animate-pulse">
                          {unansweredChats > 99 ? "99+" : unansweredChats}
                        </Badge>
                      )}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}

              {/* Auditoria — visível para Admin e Gestor (atalho fora de Configurações) */}
              {canAudit && !isAdmin && (
                <SidebarMenuItem>
                  <SidebarMenuButton
                    asChild
                    isActive={location.pathname === "/configuracoes/auditoria"}
                    tooltip="Auditoria"
                  >
                    <Link to="/configuracoes/auditoria">
                      <ShieldCheck className="h-4 w-4" />
                      <span>Auditoria</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )}

              {/* Configurações com submenus */}
              {showConfigMenu && (
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
                        {(isAdmin ? configSubItems : visibleConfigItems).map((sub) => (
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
              )}
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
