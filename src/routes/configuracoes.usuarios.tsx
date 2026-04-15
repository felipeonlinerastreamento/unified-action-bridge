import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { listGSystemUsers, listSectors, listAllOpenChats } from "@/lib/gsystem.functions";
import { createUser, updateUserRole, updateUserName, deleteUser, resetUserPassword } from "@/lib/user-admin.functions";
import { toast } from "sonner";
import {
  Users, Link as LinkIcon, Unlink, Loader2, Bot, Clock, Headphones,
  Moon, FolderTree, RefreshCw, UserPlus, Pencil, Trash2, KeyRound, Building2,
} from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { SectorGroupsManagement } from "@/components/configuracoes/sector-groups-management";

export const Route = createFileRoute("/configuracoes/usuarios")({
  component: UsuariosConfigPage,
});

type GSystemAgent = { id: string; name: string; status?: string; currentAttendanceId?: string };
type GSystemSector = { id: string; description?: string; name?: string };

const ROLE_LABEL: Record<string, string> = { admin: "Admin", gestor: "Gestor", atendente: "Atendente" };
const ROLE_VARIANT = (role: string) => {
  if (role === "admin") return "destructive" as const;
  if (role === "gestor") return "default" as const;
  return "secondary" as const;
};

function UsuariosConfigPage() {
  const { isAuthenticated, isLoading, hasRole, user: currentUser } = useAuth();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();

  // Dialog states
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<"admin" | "gestor" | "atendente">("atendente");

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"admin" | "gestor" | "atendente">("atendente");

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteUserId, setDeleteUserId] = useState<string | null>(null);
  const [deleteUserName, setDeleteUserName] = useState("");

  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const [resetUserNameLabel, setResetUserNameLabel] = useState("");
  const [resetPassword, setResetPassword] = useState("");

  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [sectorUserId, setSectorUserId] = useState<string | null>(null);
  const [sectorUserName, setSectorUserName] = useState("");
  const [selectedSectorIds, setSelectedSectorIds] = useState<string[]>([]);

  // ========== Data queries ==========
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url, group_id")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  const { data: gsystemLinks = [] } = useQuery({
    queryKey: ["admin-gsystem-links"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_gsystem_links").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  const { data: channels = [] } = useQuery({
    queryKey: ["admin-channels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("channels")
        .select("id, name")
        .eq("is_active", true);
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  // Local sectors and assignments
  const { data: localSectors = [] } = useQuery({
    queryKey: ["local-sectors-active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id, name, group_id").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  const { data: sectorGroups = [] } = useQuery({
    queryKey: ["sector-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sector_groups").select("id, name").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  const { data: userSectorAssignments = [] } = useQuery({
    queryKey: ["user-sector-assignments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_sector_assignments").select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  const firstChannelId = channels[0]?.id;

  const { data: gsystemAgents = [] } = useQuery({
    queryKey: ["gsystem-agents", firstChannelId],
    queryFn: async () => {
      if (!firstChannelId) return [];
      try {
        const result = await listGSystemUsers({ data: { channelId: firstChannelId } });
        return Array.isArray(result) ? (result as GSystemAgent[]) : [];
      } catch { return []; }
    },
    enabled: !!firstChannelId,
  });

  const { data: gsystemSectors = [] } = useQuery({
    queryKey: ["gsystem-sectors-config", firstChannelId],
    queryFn: async () => {
      if (!firstChannelId) return [];
      try {
        const result = await listSectors({ data: { channelId: firstChannelId } });
        return (Array.isArray(result) ? result : []) as GSystemSector[];
      } catch { return []; }
    },
    enabled: !!firstChannelId,
    staleTime: 60000,
  });

  const { data: chatsData, isLoading: chatsLoading, refetch: refetchChats } = useQuery({
    queryKey: ["gsystem-chats-tree", firstChannelId],
    queryFn: async () => {
      if (!firstChannelId) return { chats: [], users: [] };
      try {
        const result = await listAllOpenChats({ data: { channelId: firstChannelId } });
        const data = result as { chats: any[]; users: any[]; total?: number };
        return { chats: Array.isArray(data?.chats) ? data.chats : [], users: Array.isArray(data?.users) ? data.users : [] };
      } catch { return { chats: [], users: [] }; }
    },
    enabled: !!firstChannelId,
    staleTime: 30000,
  });

  const allChats = chatsData?.chats || [];
  const automaticChats = allChats.filter((c) => c.status === 0 || c.status === "AUTOMATIC");
  const waitingChats = allChats.filter((c) => c.status === 1 || c.status === "WAITING" || c.status === "PENDING");
  const attendingChats = allChats.filter((c) => c.status === 2 || c.status === "OPEN");
  const outOfHourChats = allChats.filter((c) => (c.timeInOutOfHour && c.timeInOutOfHour > 0) || c.status === "OUT_OF_HOUR");

  const chatsBySector = new Map<string, { name: string; count: number }>();
  for (const chat of allChats) {
    const sectorId = chat.currentSector?.id || "sem-setor";
    const sectorName = chat.currentSector?.description || "Sem setor";
    const existing = chatsBySector.get(sectorId);
    if (existing) existing.count++;
    else chatsBySector.set(sectorId, { name: sectorName, count: 1 });
  }

  // ========== Mutations ==========
  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-user-roles"] });
    queryClient.invalidateQueries({ queryKey: ["admin-gsystem-links"] });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      return createUser({ data: { email: newEmail, password: newPassword, name: newName, role: newRole } });
    },
    onSuccess: () => {
      toast.success("Usuário criado com sucesso");
      invalidateAll();
      setCreateDialogOpen(false);
      setNewEmail(""); setNewPassword(""); setNewName(""); setNewRole("atendente");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const editMutation = useMutation({
    mutationFn: async () => {
      if (!editUserId) return;
      await updateUserName({ data: { targetUserId: editUserId, name: editName } });
      await updateUserRole({ data: { targetUserId: editUserId, role: editRole } });
    },
    onSuccess: () => {
      toast.success("Usuário atualizado");
      invalidateAll();
      setEditDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!deleteUserId) return;
      return deleteUser({ data: { targetUserId: deleteUserId } });
    },
    onSuccess: () => {
      toast.success("Usuário excluído");
      invalidateAll();
      setDeleteDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const resetMutation = useMutation({
    mutationFn: async () => {
      if (!resetUserId || !resetPassword) return;
      return resetUserPassword({ data: { targetUserId: resetUserId, newPassword: resetPassword } });
    },
    onSuccess: () => {
      toast.success("Senha redefinida com sucesso");
      setResetDialogOpen(false);
      setResetPassword("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const linkMutation = useMutation({
    mutationFn: async ({ userId, agentId, agentName }: { userId: string; agentId: string; agentName: string }) => {
      const { error } = await supabase.from("user_gsystem_links").upsert(
        { user_id: userId, gsystem_user_id: agentId, gsystem_user_name: agentName, channel_id: firstChannelId || null },
        { onConflict: "user_id,channel_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agente vinculado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-gsystem-links"] });
      setLinkDialogOpen(false);
    },
    onError: (e: Error) => toast.error(`Erro ao vincular: ${e.message}`),
  });

  const unlinkMutation = useMutation({
    mutationFn: async (linkId: string) => {
      const { error } = await supabase.from("user_gsystem_links").delete().eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Vínculo removido");
      queryClient.invalidateQueries({ queryKey: ["admin-gsystem-links"] });
    },
    onError: (e: Error) => toast.error(`Erro ao desvincular: ${e.message}`),
  });

  const sectorAssignMutation = useMutation({
    mutationFn: async ({ userId, sectorIds }: { userId: string; sectorIds: string[] }) => {
      // Remove all existing assignments
      await supabase.from("user_sector_assignments").delete().eq("user_id", userId);
      // Insert new ones
      if (sectorIds.length > 0) {
        const rows = sectorIds.map((sid) => ({ user_id: userId, sector_id: sid }));
        const { error } = await supabase.from("user_sector_assignments").insert(rows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Setores do usuário atualizados");
      queryClient.invalidateQueries({ queryKey: ["user-sector-assignments"] });
      setSectorDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const groupAssignMutation = useMutation({
    mutationFn: async ({ userId, groupId }: { userId: string; groupId: string | null }) => {
      const { error } = await supabase.from("profiles").update({ group_id: groupId }).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo do usuário atualizado");
      queryClient.invalidateQueries({ queryKey: ["admin-profiles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // ========== Helpers ==========
  const getRolesForUser = (userId: string) => userRoles.filter((r) => r.user_id === userId).map((r) => r.role);
  const getLinkForUser = (userId: string) => gsystemLinks.find((l) => l.user_id === userId);
  const getSectorsForUser = (userId: string) => userSectorAssignments.filter((a) => a.user_id === userId).map((a) => a.sector_id);

  const handleOpenLink = (userId: string) => {
    setSelectedUserId(userId);
    const existing = getLinkForUser(userId);
    setSelectedAgentId(existing?.gsystem_user_id || "");
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    if (!selectedUserId || !selectedAgentId) return;
    const agent = gsystemAgents.find((a) => a.id === selectedAgentId);
    linkMutation.mutate({ userId: selectedUserId, agentId: selectedAgentId, agentName: agent?.name || selectedAgentId });
  };

  const handleOpenSectors = (profile: { user_id: string; name: string }) => {
    setSectorUserId(profile.user_id);
    setSectorUserName(profile.name || "Sem nome");
    setSelectedSectorIds(getSectorsForUser(profile.user_id));
    setSectorDialogOpen(true);
  };

  const handleOpenEdit = (profile: { user_id: string; name: string }) => {
    setEditUserId(profile.user_id);
    setEditName(profile.name || "");
    const roles = getRolesForUser(profile.user_id);
    setEditRole((roles[0] as any) || "atendente");
    setEditDialogOpen(true);
  };

  const handleOpenReset = (profile: { user_id: string; name: string }) => {
    setResetUserId(profile.user_id);
    setResetUserNameLabel(profile.name || "Sem nome");
    setResetPassword("");
    setResetDialogOpen(true);
  };

  const handleOpenDelete = (profile: { user_id: string; name: string }) => {
    setDeleteUserId(profile.user_id);
    setDeleteUserName(profile.name || "Sem nome");
    setDeleteDialogOpen(true);
  };

  if (isLoading || !isAuthenticated) return null;
  if (!isAdmin) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Acesso restrito a administradores.</p>
        </div>
      </AppLayout>
    );
  }

  const categories = [
    { label: "Automático", icon: Bot, color: "text-blue-600 bg-blue-50 border-blue-200", count: automaticChats.length },
    { label: "Aguardando", icon: Clock, color: "text-amber-600 bg-amber-50 border-amber-200", count: waitingChats.length },
    { label: "Em atendimento", icon: Headphones, color: "text-emerald-600 bg-emerald-50 border-emerald-200", count: attendingChats.length },
    { label: "Fora de hora", icon: Moon, color: "text-purple-600 bg-purple-50 border-purple-200", count: outOfHourChats.length },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de usuários, papéis e vinculação com agentes do GSystem
          </p>
        </div>

        {/* ========== Árvore de Atendimento ========== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FolderTree className="h-4 w-4" /> Árvore de Atendimento — GSystem
            </CardTitle>
            <Button size="sm" variant="ghost" onClick={() => refetchChats()} disabled={chatsLoading}>
              <RefreshCw className={`h-3.5 w-3.5 ${chatsLoading ? "animate-spin" : ""}`} />
            </Button>
          </CardHeader>
          <CardContent>
            {!firstChannelId ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum canal ativo configurado.</p>
            ) : chatsLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Categorias</p>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {categories.map((cat) => (
                      <div key={cat.label} className={`flex items-center gap-2 rounded-lg border p-3 ${cat.color}`}>
                        <cat.icon className="h-4 w-4 shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium truncate">{cat.label}</p>
                          <p className="text-lg font-bold leading-tight">{cat.count}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Grupos (Setores)</p>
                  {gsystemSectors.length === 0 && chatsBySector.size === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum setor encontrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {gsystemSectors.map((sector) => {
                        const count = chatsBySector.get(sector.id)?.count || 0;
                        return (
                          <div key={sector.id} className="flex items-center justify-between rounded-md border border-border bg-card p-2.5">
                            <span className="text-sm font-medium truncate">{sector.description || sector.name || sector.id}</span>
                            <Badge variant={count > 0 ? "default" : "secondary"} className="text-xs ml-2 shrink-0">
                              {count} chat{count !== 1 ? "s" : ""}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <Separator />

                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">Agentes Online</p>
                  {gsystemAgents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhum agente encontrado.</p>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                      {gsystemAgents.map((agent) => {
                        const isOnline = agent.status === "ONLINE" || agent.status === "online";
                        const isBusy = !!agent.currentAttendanceId;
                        const link = gsystemLinks.find((l) => l.gsystem_user_id === agent.id);
                        return (
                          <div key={agent.id} className="flex items-center gap-2 rounded-md border border-border bg-card p-2.5">
                            <span className={`h-2 w-2 rounded-full shrink-0 ${isOnline ? (isBusy ? "bg-amber-500" : "bg-emerald-500") : "bg-muted-foreground"}`} />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium truncate">{agent.name}</p>
                              {link && (
                                <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                                  <LinkIcon className="h-2.5 w-2.5" />
                                  {profiles.find((p) => p.user_id === link.user_id)?.name || "Vinculado"}
                                </p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-[10px] shrink-0">
                              {isOnline ? (isBusy ? "Ocupado" : "Online") : "Offline"}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ========== Tabela de Usuários ========== */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Usuários do Sistema
            </CardTitle>
            <Button size="sm" onClick={() => setCreateDialogOpen(true)}>
              <UserPlus className="h-4 w-4 mr-1" /> Novo Usuário
            </Button>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum usuário cadastrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Papéis</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Setores</TableHead>
                    <TableHead>Agente GSystem</TableHead>
                    <TableHead className="w-[200px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const roles = getRolesForUser(profile.user_id);
                    const link = getLinkForUser(profile.user_id);
                    const userSectors = getSectorsForUser(profile.user_id);
                    const isSelf = profile.user_id === currentUser?.id;
                    return (
                      <TableRow key={profile.user_id}>
                        <TableCell className="font-medium">{profile.name || "Sem nome"}</TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {roles.length > 0 ? roles.map((r) => (
                              <Badge key={r} variant={ROLE_VARIANT(r)} className="text-xs">{ROLE_LABEL[r] || r}</Badge>
                            )) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={profile.group_id || "none"}
                            onValueChange={(v) => groupAssignMutation.mutate({ userId: profile.user_id, groupId: v === "none" ? null : v })}
                          >
                            <SelectTrigger className="h-8 w-[140px] text-xs">
                              <SelectValue placeholder="Sem grupo" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">Sem grupo</SelectItem>
                              {sectorGroups.map((g) => (
                                <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {userSectors.length > 0 ? userSectors.map((sid) => {
                              const sec = localSectors.find((s) => s.id === sid);
                              return <Badge key={sid} variant="outline" className="text-xs">{sec?.name || "?"}</Badge>;
                            }) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {link ? (
                            <div className="flex items-center gap-1.5">
                              <LinkIcon className="h-3.5 w-3.5 text-primary" />
                              <span className="text-sm">{link.gsystem_user_name}</span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">Não vinculado</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" onClick={() => handleOpenSectors(profile)} title="Setores">
                              <Building2 className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleOpenEdit(profile)} title="Editar">
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => handleOpenLink(profile.user_id)} title="Vincular GSystem">
                              <LinkIcon className="h-3.5 w-3.5" />
                            </Button>
                            {link && (
                              <Button size="sm" variant="ghost" onClick={() => unlinkMutation.mutate(link.id)} disabled={unlinkMutation.isPending} title="Desvincular">
                                <Unlink className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                            {!isSelf && (
                              <Button size="sm" variant="outline" onClick={() => handleOpenReset(profile)} title="Redefinir Senha">
                                <KeyRound className="h-3.5 w-3.5" />
                              </Button>
                            )}
                            {!isSelf && (
                              <Button size="sm" variant="ghost" onClick={() => handleOpenDelete(profile)} title="Excluir">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ========== Create User Dialog ========== */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Novo Usuário</DialogTitle>
            <DialogDescription>Crie um novo usuário de acesso ao sistema. Ele já poderá fazer login imediatamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nome completo" />
            </div>
            <div className="space-y-2">
              <Label>E-mail</Label>
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="email@exemplo.com" />
            </div>
            <div className="space-y-2">
              <Label>Senha</Label>
              <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendente">Atendente</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => createMutation.mutate()} disabled={createMutation.isPending || !newEmail || !newPassword || !newName}>
                {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Criar Usuário
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Edit User Dialog ========== */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar Usuário</DialogTitle>
            <DialogDescription>Altere o nome e o papel do usuário no sistema.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Papel</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="atendente">Atendente</SelectItem>
                  <SelectItem value="gestor">Gestor</SelectItem>
                  <SelectItem value="admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => editMutation.mutate()} disabled={editMutation.isPending || !editName}>
                {editMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Delete Confirm Dialog ========== */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Usuário</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteUserName}</strong>? Esta ação é irreversível e removerá o acesso deste usuário ao sistema.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMutation.mutate()} disabled={deleteMutation.isPending} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ========== Reset Password Dialog ========== */}
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir Senha</DialogTitle>
            <DialogDescription>Defina uma nova senha para <strong>{resetUserNameLabel}</strong>.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Nova Senha</Label>
              <Input type="password" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Mínimo 6 caracteres" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setResetDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => resetMutation.mutate()} disabled={resetMutation.isPending || resetPassword.length < 6}>
                {resetMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Redefinir Senha
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Link GSystem Dialog ========== */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Agente GSystem</DialogTitle>
            <DialogDescription>Selecione o agente do GSystem para vincular a este usuário. Isso garante que as interações no chat e chamados sejam exibidas com o nome correto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <p className="text-sm font-medium mb-1">Usuário</p>
              <p className="text-sm text-muted-foreground">
                {profiles.find((p) => p.user_id === selectedUserId)?.name || "—"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium mb-1">Agente GSystem</p>
              {gsystemAgents.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum canal ativo ou agentes encontrados.</p>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um agente" /></SelectTrigger>
                  <SelectContent>
                    {gsystemAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>{agent.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>Cancelar</Button>
              <Button onClick={handleSaveLink} disabled={!selectedAgentId || linkMutation.isPending}>
                {linkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Vincular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* ========== Sector Assignment Dialog ========== */}
      <Dialog open={sectorDialogOpen} onOpenChange={setSectorDialogOpen}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Setores de {sectorUserName}</DialogTitle>
            <DialogDescription>Selecione os setores que este usuário pode atender.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {localSectors.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum setor cadastrado. Cadastre setores em Configurações &gt; Encaminhamento.</p>
            ) : (
              <>
                {sectorGroups.map((group) => {
                  const groupSectors = localSectors.filter((s) => s.group_id === group.id);
                  if (groupSectors.length === 0) return null;
                  return (
                    <div key={group.id} className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{group.name}</p>
                      <div className="space-y-1.5">
                        {groupSectors.map((sector) => (
                          <label key={sector.id} className="flex items-center gap-2 cursor-pointer rounded-md border border-border p-2 hover:bg-accent/50">
                            <Checkbox
                              checked={selectedSectorIds.includes(sector.id)}
                              onCheckedChange={(checked) => {
                                setSelectedSectorIds((prev) =>
                                  checked ? [...prev, sector.id] : prev.filter((id) => id !== sector.id)
                                );
                              }}
                            />
                            <span className="text-sm">{sector.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
                {(() => {
                  const ungrouped = localSectors.filter((s) => !s.group_id);
                  if (ungrouped.length === 0) return null;
                  return (
                    <div className="space-y-2">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Sem grupo</p>
                      <div className="space-y-1.5">
                        {ungrouped.map((sector) => (
                          <label key={sector.id} className="flex items-center gap-2 cursor-pointer rounded-md border border-border p-2 hover:bg-accent/50">
                            <Checkbox
                              checked={selectedSectorIds.includes(sector.id)}
                              onCheckedChange={(checked) => {
                                setSelectedSectorIds((prev) =>
                                  checked ? [...prev, sector.id] : prev.filter((id) => id !== sector.id)
                                );
                              }}
                            />
                            <span className="text-sm">{sector.name}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setSectorDialogOpen(false)}>Cancelar</Button>
              <Button
                onClick={() => sectorUserId && sectorAssignMutation.mutate({ userId: sectorUserId, sectorIds: selectedSectorIds })}
                disabled={sectorAssignMutation.isPending}
              >
                {sectorAssignMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
