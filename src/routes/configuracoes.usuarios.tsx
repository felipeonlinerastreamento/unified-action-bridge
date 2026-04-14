import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { listGSystemUsers } from "@/lib/gsystem.functions";
import { toast } from "sonner";
import { Users, Link as LinkIcon, Unlink, Loader2 } from "lucide-react";

export const Route = createFileRoute("/configuracoes/usuarios")({
  component: UsuariosConfigPage,
});

type GSystemAgent = { id: string; name: string; status?: string };

function UsuariosConfigPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();

  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedAgentId, setSelectedAgentId] = useState("");

  // Fetch profiles
  const { data: profiles = [], isLoading: profilesLoading } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name, avatar_url")
        .order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch user roles
  const { data: userRoles = [] } = useQuery({
    queryKey: ["admin-user-roles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("user_id, role");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch existing gsystem links
  const { data: gsystemLinks = [] } = useQuery({
    queryKey: ["admin-gsystem-links"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_gsystem_links")
        .select("*");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  // Fetch active channels to get GSystem users
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

  // Fetch GSystem agents from first active channel
  const firstChannelId = channels[0]?.id;
  const { data: gsystemAgents = [] } = useQuery({
    queryKey: ["gsystem-agents", firstChannelId],
    queryFn: async () => {
      if (!firstChannelId) return [];
      const result = await listGSystemUsers({ data: { channelId: firstChannelId } });
      return (result as GSystemAgent[]) || [];
    },
    enabled: !!firstChannelId,
  });

  // Link mutation
  const linkMutation = useMutation({
    mutationFn: async ({ userId, agentId, agentName }: { userId: string; agentId: string; agentName: string }) => {
      const { error } = await supabase.from("user_gsystem_links").upsert(
        {
          user_id: userId,
          gsystem_user_id: agentId,
          gsystem_user_name: agentName,
          channel_id: firstChannelId || null,
        },
        { onConflict: "user_id,channel_id" }
      );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Agente vinculado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["admin-gsystem-links"] });
      setLinkDialogOpen(false);
      setSelectedUserId(null);
      setSelectedAgentId("");
    },
    onError: (e: Error) => toast.error(`Erro ao vincular: ${e.message}`),
  });

  // Unlink mutation
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

  const getRolesForUser = (userId: string) =>
    userRoles.filter((r) => r.user_id === userId).map((r) => r.role);

  const getLinkForUser = (userId: string) =>
    gsystemLinks.find((l) => l.user_id === userId);

  const handleOpenLink = (userId: string) => {
    setSelectedUserId(userId);
    const existing = getLinkForUser(userId);
    setSelectedAgentId(existing?.gsystem_user_id || "");
    setLinkDialogOpen(true);
  };

  const handleSaveLink = () => {
    if (!selectedUserId || !selectedAgentId) return;
    const agent = gsystemAgents.find((a) => a.id === selectedAgentId);
    linkMutation.mutate({
      userId: selectedUserId,
      agentId: selectedAgentId,
      agentName: agent?.name || selectedAgentId,
    });
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

  const roleLabel: Record<string, string> = {
    admin: "Admin",
    gestor: "Gestor",
    atendente: "Atendente",
  };

  const roleVariant = (role: string) => {
    if (role === "admin") return "destructive" as const;
    if (role === "gestor") return "default" as const;
    return "secondary" as const;
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Usuários</h1>
          <p className="text-sm text-muted-foreground">
            Gestão de usuários, papéis e vinculação com agentes do GSystem
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" /> Usuários do Sistema
            </CardTitle>
          </CardHeader>
          <CardContent>
            {profilesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : profiles.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum usuário cadastrado.
              </p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Papéis</TableHead>
                    <TableHead>Agente GSystem</TableHead>
                    <TableHead className="w-[120px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {profiles.map((profile) => {
                    const roles = getRolesForUser(profile.user_id);
                    const link = getLinkForUser(profile.user_id);
                    return (
                      <TableRow key={profile.user_id}>
                        <TableCell className="font-medium">
                          {profile.name || "Sem nome"}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1 flex-wrap">
                            {roles.length > 0 ? (
                              roles.map((r) => (
                                <Badge key={r} variant={roleVariant(r)} className="text-xs">
                                  {roleLabel[r] || r}
                                </Badge>
                              ))
                            ) : (
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
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenLink(profile.user_id)}
                            >
                              <LinkIcon className="h-3.5 w-3.5" />
                            </Button>
                            {link && (
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => unlinkMutation.mutate(link.id)}
                                disabled={unlinkMutation.isPending}
                              >
                                <Unlink className="h-3.5 w-3.5 text-destructive" />
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

      {/* Link Dialog */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Vincular Agente GSystem</DialogTitle>
            <DialogDescription>
              Selecione o agente do GSystem para vincular a este usuário do sistema.
            </DialogDescription>
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
                <p className="text-sm text-muted-foreground">
                  Nenhum canal ativo ou agentes encontrados.
                </p>
              ) : (
                <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione um agente" />
                  </SelectTrigger>
                  <SelectContent>
                    {gsystemAgents.map((agent) => (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setLinkDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                onClick={handleSaveLink}
                disabled={!selectedAgentId || linkMutation.isPending}
              >
                {linkMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Vincular
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
