import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Activity, Search, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/configuracoes/status-usuarios")({
  component: StatusUsuariosPage,
});

interface UserStatus {
  user_id: string;
  name: string | null;
  is_chat_available: boolean;
  last_seen_at: string | null;
  roles: string[];
}

const ONLINE_THRESHOLD_MS = 2 * 60 * 1000; // 2 minutes

function isOnline(lastSeen: string | null): boolean {
  if (!lastSeen) return false;
  return Date.now() - new Date(lastSeen).getTime() < ONLINE_THRESHOLD_MS;
}

function StatusUsuariosPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const [users, setUsers] = useState<UserStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [, forceTick] = useState(0);

  const isAllowed = hasRole("admin") || hasRole("gestor");

  useEffect(() => {
    if (!isAuthenticated || !isAllowed) return;

    const load = async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, name, is_chat_available, last_seen_at"),
        supabase.from("user_roles").select("user_id, role"),
      ]);

      const rolesByUser: Record<string, string[]> = {};
      (roles || []).forEach((r: any) => {
        if (!rolesByUser[r.user_id]) rolesByUser[r.user_id] = [];
        rolesByUser[r.user_id].push(r.role);
      });

      setUsers(
        (profiles || []).map((p: any) => ({
          user_id: p.user_id,
          name: p.name,
          is_chat_available: p.is_chat_available ?? true,
          last_seen_at: p.last_seen_at,
          roles: rolesByUser[p.user_id] || [],
        }))
      );
      setLoading(false);
    };

    load();
    const interval = setInterval(load, 15_000);
    const tick = setInterval(() => forceTick((t) => t + 1), 30_000);
    return () => {
      clearInterval(interval);
      clearInterval(tick);
    };
  }, [isAuthenticated, isAllowed]);

  if (isLoading) return null;
  if (!isAuthenticated) {
    throw redirect({ to: "/login" as any });
  }

  if (!isAllowed) {
    return (
      <AppLayout>
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Acesso restrito a administradores e gestores.
          </CardContent>
        </Card>
      </AppLayout>
    );
  }

  const filtered = users.filter((u) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (u.name || "").toLowerCase().includes(q);
  });

  const onlineCount = filtered.filter((u) => isOnline(u.last_seen_at)).length;
  const availableCount = filtered.filter((u) => isOnline(u.last_seen_at) && u.is_chat_available).length;

  const toggleAvailability = async (userId: string, next: boolean) => {
    const { error } = await supabase
      .from("profiles")
      .update({ is_chat_available: next })
      .eq("user_id", userId);
    if (error) {
      toast.error("Erro ao atualizar status");
      return;
    }
    setUsers((prev) => prev.map((u) => (u.user_id === userId ? { ...u, is_chat_available: next } : u)));
    toast.success("Status atualizado");
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Activity className="h-6 w-6" /> Status de Usuários
          </h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe quem está logado, online e disponível para receber chamados no chat.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <StatCard label="Total cadastrados" value={users.length} />
          <StatCard label="Logados (últimos 2 min)" value={onlineCount} accent="emerald" />
          <StatCard label="Disponíveis no chat" value={availableCount} accent="emerald" />
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2">
            <CardTitle className="text-base">Operadores</CardTitle>
            <div className="relative w-64 max-w-full">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome..."
                className="pl-9 h-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            {loading ? (
              <div className="py-12 flex items-center justify-center text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando...
              </div>
            ) : filtered.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Nenhum usuário encontrado.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Perfis</TableHead>
                    <TableHead>Status de sessão</TableHead>
                    <TableHead>Última atividade</TableHead>
                    <TableHead className="text-right">Disponível no chat</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((u) => {
                    const online = isOnline(u.last_seen_at);
                    return (
                      <TableRow key={u.user_id}>
                        <TableCell>
                          <div className="font-medium text-sm">{u.name || "(sem nome)"}</div>
                        </TableCell>
                        <TableCell>
                          <div className="flex flex-wrap gap-1">
                            {u.roles.length === 0 && (
                              <Badge variant="outline" className="text-[10px]">sem perfil</Badge>
                            )}
                            {u.roles.map((r) => (
                              <Badge key={r} variant="secondary" className="text-[10px] capitalize">
                                {r}
                              </Badge>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-xs">
                            <span
                              className={cn(
                                "h-2 w-2 rounded-full",
                                online ? "bg-emerald-500" : "bg-muted-foreground/50"
                              )}
                            />
                            {online ? "Online" : "Offline"}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {u.last_seen_at
                            ? formatDistanceToNow(new Date(u.last_seen_at), { addSuffix: true, locale: ptBR })
                            : "Nunca acessou"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="inline-flex items-center gap-2">
                            <span className={cn("text-xs", u.is_chat_available ? "text-emerald-600" : "text-muted-foreground")}>
                              {u.is_chat_available ? "Sim" : "Não"}
                            </span>
                            <Switch
                              checked={u.is_chat_available}
                              onCheckedChange={(v) => toggleAvailability(u.user_id, v)}
                            />
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
    </AppLayout>
  );
}

function StatCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("text-2xl font-bold mt-1", accent === "emerald" && "text-emerald-600")}>
          {value}
        </div>
      </CardContent>
    </Card>
  );
}
