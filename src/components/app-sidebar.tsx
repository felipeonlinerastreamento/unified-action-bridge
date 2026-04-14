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
  PhoneCall,
  Plug,
  ChevronDown,
  Boxes,
  UserCog,
} from "lucide-react";
import { Link, useLocation } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
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
  { title: "Atendimentos", url: "/atendimentos", icon: MessageSquare },
  { title: "Central", url: "/central", icon: Headphones },
  { title: "CRM", url: "/crm", icon: UserPlus },
  { title: "Contatos", url: "/contatos", icon: Users },
  { title: "Empresas", url: "/empresas", icon: Building2 },
  { title: "Estoque", url: "/estoque", icon: Package },
  { title: "Relatórios", url: "/relatorios", icon: BarChart3 },
];

const configSubItems = [
  { title: "Integrações", url: "/configuracoes", icon: Plug },
  { title: "Central de Atendimento", url: "/configuracoes/central-atendimento", icon: PhoneCall },
  { title: "Estoque", url: "/configuracoes/estoque", icon: Boxes },
  { title: "Assistente IA", url: "/configuracoes/assistente-ia", icon: Bot },
  { title: "Usuários", url: "/configuracoes/usuarios", icon: UserCog },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const { profile, signOut } = useAuth();

  const isConfigActive = location.pathname.startsWith("/configuracoes");

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
              {mainItems.map((item) => (
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
            <SidebarMenuButton onClick={signOut} tooltip="Sair">
              <LogOut className="h-4 w-4" />
              <span>{profile?.name || "Sair"}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
