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
  Trophy,
  CalendarDays,
  Map,
  CalendarClock,
  FileSignature,
  LayoutGrid,
} from "lucide-react";


import { Link, useLocation } from "@tanstack/react-router";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { useUserPermissions } from "@/hooks/use-user-permissions";
import { URL_TO_MENU_SLUG, isApplicationPath } from "@/lib/menu-catalog";
import { useEffect, useState } from "react";
import { useSidebarCounters } from "@/hooks/use-sidebar-counters";
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
import { canSeeGamification } from "@/lib/gamif-rules";
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
];

const atendimentosSubItems: { title: string; url: string; icon: typeof List }[] = [
  { title: "Lista", url: "/atendimentos", icon: List },
  // { title: "Tarefas", url: "/atendimentos/tarefas", icon: CheckSquare }, // inativado
];

const agendaSubItems = [
  { title: "Atividades", url: "/agenda/atividades", icon: List },
  { title: "Timeline", url: "/agenda/timeline", icon: Activity },
  { title: "Mapa", url: "/agenda/mapa", icon: Map },
  { title: "Solicitações", url: "/agenda/solicitacoes", icon: CalendarClock },
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
  { title: "Robô de Atendimento", url: "/configuracoes/robo-atendimento", icon: Bot },
  { title: "Popup Diário", url: "/configuracoes/popup-diario", icon: Sun },
  { title: "Usuários", url: "/configuracoes/usuarios", icon: UserCog },
  { title: "Status de Usuários", url: "/configuracoes/status-usuarios", icon: Activity },
  { title: "CRM", url: "/configuracoes/crm", icon: FileSignature },
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

  // Contadores do menu: uma única consulta de resumo a cada 60s (pausa com a
  // aba em segundo plano). Mesmas regras de antes, calculadas no banco.
  const {
    assigned_chats: assignedChats,
    open_tickets: openTickets,
    unread_operator_msgs: unreadOperatorMsgs,
  } = useSidebarCounters();

  const isConfigActive = location.pathname.startsWith("/configuracoes");
  const isAgendaActive = location.pathname.startsWith("/agenda");
  const isAtendimentosActive = location.pathname.startsWith("/atendimentos");

  const canSeeUrl = (url: string) => {
    const slug = URL_TO_MENU_SLUG[url];
    if (!slug) return true;
    return canSeeMenu(slug);
  };

  const visibleConfigItems = configSubItems.filter((sub) => canSeeUrl(sub.url));
  const showConfigMenu = isAdmin || visibleConfigItems.length > 0;

  const visibleAgendaItems = agendaSubItems.filter((sub) => canSeeUrl(sub.url));

  // Grupo "Aplicações": cada item mantém a mesma permissão de antes.
  const showPainelTv = canSeeUrl("/painel-tv");
  const showAssistente = canSeeUrl("/assistente-ia");
  const showAgenda = visibleAgendaItems.length > 0;
  const showGamificacao = canSeeGamification({ isAdmin });
  const showApps = showPainelTv || showAssistente || showAgenda || showGamificacao;
  const isAppsActive = isApplicationPath(location.pathname);
  const [appsOpen, setAppsOpen] = useState(isAppsActive);
  const [agendaOpen, setAgendaOpen] = useState(isAgendaActive);
  useEffect(() => { if (isAppsActive) setAppsOpen(true); }, [isAppsActive]);
  useEffect(() => { if (isAgendaActive) setAgendaOpen(true); }, [isAgendaActive]);
  const appLinks = [
    { show: showPainelTv, title: "Painel TV", url: "/painel-tv", icon: Monitor },
    { show: showAssistente, title: "Assistente IA", url: "/assistente-ia", icon: Bot },
  ];



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
                      {openTickets > 0 && (
                        <Badge className="ml-auto h-5 min-w-[20px] px-1 bg-red-600 text-white text-[11px] font-bold animate-pulse">
                          {openTickets > 99 ? "99+" : openTickets}
                        </Badge>
                      )}
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
                      {item.url === "/central" && assignedChats > 0 && (
                        <Badge className="ml-auto h-5 min-w-[20px] px-1 bg-red-600 text-white text-[11px] font-bold animate-pulse">
                          {assignedChats > 99 ? "99+" : assignedChats}
                        </Badge>
                      )}
                      {item.url === "/chat-operadores" && unreadOperatorMsgs > 0 && (
                        <Badge className="ml-auto h-5 min-w-[20px] px-1 bg-red-600 text-white text-[11px] font-bold animate-pulse">
                          {unreadOperatorMsgs > 99 ? "99+" : unreadOperatorMsgs}
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

              {/* Aplicações: Painel TV, Assistente IA, Agenda (com submenus) e Gamificação */}
              {showApps && (
                <Collapsible open={appsOpen} onOpenChange={setAppsOpen} className="group/apps">
                  <SidebarMenuItem>
                    <CollapsibleTrigger asChild>
                      <SidebarMenuButton isActive={isAppsActive} tooltip="Aplicações">
                        <LayoutGrid className="h-4 w-4" />
                        <span>Aplicações</span>
                        <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/apps:rotate-180" />
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {appLinks.filter((a) => a.show).map((a) => (
                          <SidebarMenuSubItem key={a.url}>
                            <SidebarMenuSubButton asChild isActive={location.pathname.startsWith(a.url)}>
                              <Link to={a.url}>
                                <a.icon className="h-3.5 w-3.5" />
                                <span>{a.title}</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        ))}

                        {showAgenda && (
                          <Collapsible open={agendaOpen} onOpenChange={setAgendaOpen} className="group/agenda">
                            <SidebarMenuSubItem>
                              <CollapsibleTrigger asChild>
                                <SidebarMenuSubButton asChild isActive={isAgendaActive}>
                                  <button type="button" className="w-full">
                                    <CalendarDays className="h-3.5 w-3.5" />
                                    <span>Agenda</span>
                                    <ChevronDown className="ml-auto h-3.5 w-3.5 transition-transform group-data-[state=open]/agenda:rotate-180" />
                                  </button>
                                </SidebarMenuSubButton>
                              </CollapsibleTrigger>
                              <CollapsibleContent>
                                <SidebarMenuSub>
                                  {visibleAgendaItems.map((sub) => (
                                    <SidebarMenuSubItem key={sub.title}>
                                      <SidebarMenuSubButton asChild isActive={location.pathname === sub.url}>
                                        <Link to={sub.url}>
                                          <sub.icon className="h-3.5 w-3.5" />
                                          <span>{sub.title}</span>
                                        </Link>
                                      </SidebarMenuSubButton>
                                    </SidebarMenuSubItem>
                                  ))}
                                </SidebarMenuSub>
                              </CollapsibleContent>
                            </SidebarMenuSubItem>
                          </Collapsible>
                        )}

                        {showGamificacao && (
                          <SidebarMenuSubItem>
                            <SidebarMenuSubButton asChild isActive={location.pathname.startsWith("/gamificacao")}>
                              <Link to="/gamificacao">
                                <Trophy className="h-3.5 w-3.5" />
                                <span>Gamificação</span>
                              </Link>
                            </SidebarMenuSubButton>
                          </SidebarMenuSubItem>
                        )}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
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
