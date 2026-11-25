import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { createClientUser, updateClientUser, updateUserPassword } from "@/lib/ge/users.functions";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";

export const Route = createFileRoute("/gestao-eventos/admin/users")({
  component: AdminUsers,
});

type AppRole = "admin_platform" | "admin_client" | "admin_group" | "operator";

function AdminUsers() {
  const { isPlatformAdmin, isClientAdmin, profile, impersonatedClient } = useAuth();
  const qc = useQueryClient();
  const scopedClientId = impersonatedClient
    ? impersonatedClient.id
    : !isPlatformAdmin && isClientAdmin
      ? profile?.client_id ?? null
      : null;

  const canAccess = isPlatformAdmin || isClientAdmin;

  const { data: users } = useQuery({
    queryKey: ["admin-users", scopedClientId ?? "all"],
    enabled: canAccess,
    queryFn: async () => {
      let pq = supabase.from("ge_profiles").select("id,email,full_name,client_id,group_id,is_active");
      if (scopedClientId) pq = pq.eq("client_id", scopedClientId);
      const { data: profiles } = await pq;
      const ids = (profiles ?? []).map((p) => p.id);
      const { data: roles } = ids.length
        ? await supabase.from("ge_user_roles").select("user_id,role").in("user_id", ids)
        : { data: [] as { user_id: string; role: string }[] };
      const { data: clients } = await supabase.from("ge_clients").select("id,name");
      const { data: groups } = await supabase.from("ge_client_groups").select("id,name");
      const cmap = new Map((clients ?? []).map((c) => [c.id, c.name]));
      const gmap = new Map((groups ?? []).map((g) => [g.id, g.name]));
      const rmap = new Map<string, string[]>();
      (roles ?? []).forEach((r) => {
        const arr = rmap.get(r.user_id) ?? [];
        arr.push(r.role); rmap.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({
        ...p,
        client_name: p.client_id ? cmap.get(p.client_id) : null,
        group_name: p.group_id ? gmap.get(p.group_id) : null,
        roles: rmap.get(p.id) ?? [],
      }));
    },
  });

  const { data: clients } = useQuery({
    queryKey: ["clients-list-light", scopedClientId ?? "all"],
    enabled: canAccess,
    queryFn: async () => {
      let q = supabase.from("ge_clients").select("id,name").order("name");
      if (scopedClientId) q = q.eq("id", scopedClientId);
      return (await q).data ?? [];
    },
  });

  const { data: groups } = useQuery({
    queryKey: ["groups-list-light"],
    enabled: isPlatformAdmin,
    queryFn: async () => (await supabase.from("ge_client_groups").select("id,name").order("name")).data ?? [],
  });

  // Frotas acessíveis (RLS limita ao escopo do administrador)
  const { data: fleets } = useQuery({
    queryKey: ["users-fleets", scopedClientId ?? "all"],
    enabled: canAccess,
    queryFn: async () => {
      let q = supabase.from("ge_fleets").select("id,client_id,name").order("name");
      if (scopedClientId) q = q.eq("client_id", scopedClientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: fleetLinks } = useQuery({
    queryKey: ["users-fleet-responsibles", scopedClientId ?? "all"],
    enabled: canAccess,
    queryFn: async () => {
      let q = supabase.from("ge_fleet_responsibles").select("id,fleet_id,user_id,client_id");
      if (scopedClientId) q = q.eq("client_id", scopedClientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidateFleets = () => {
    void qc.invalidateQueries({ queryKey: ["users-fleet-responsibles"] });
    void qc.invalidateQueries({ queryKey: ["fleet-responsibles"] });
  };

  const toggleFleetResponsible = async (
    user: { id: string; client_id: string | null },
    fleetId: string,
    checked: boolean,
  ) => {
    if (!user.client_id) return toast.error("Vincule o usuário a um cliente antes de atribuir frotas");
    if (checked) {
      const { error } = await supabase
        .from("ge_fleet_responsibles")
        .insert({ fleet_id: fleetId, user_id: user.id, client_id: user.client_id });
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase
        .from("ge_fleet_responsibles")
        .delete()
        .eq("fleet_id", fleetId)
        .eq("user_id", user.id);
      if (error) return toast.error(error.message);
    }
    invalidateFleets();
  };

  const assignRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("ge_user_roles").insert({ user_id: userId, role });
    if (error) toast.error(error.message); else { toast.success("Papel atribuído"); void qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  };

  const removeRole = async (userId: string, role: AppRole) => {
    const { error } = await supabase.from("ge_user_roles").delete().eq("user_id", userId).eq("role", role);
    if (error) toast.error(error.message); else { toast.success("Papel removido"); void qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  };

  // Escopo: cliente único, grupo, ou plataforma (nenhum vínculo).
  const setScope = async (userId: string, value: string) => {
    let patch: { client_id: string | null; group_id: string | null };
    if (value.startsWith("client:")) patch = { client_id: value.slice(7), group_id: null };
    else if (value.startsWith("group:")) patch = { client_id: null, group_id: value.slice(6) };
    else patch = { client_id: null, group_id: null };
    const { error } = await supabase.from("ge_profiles").update(patch).eq("id", userId);
    if (error) toast.error(error.message); else { toast.success("Escopo atualizado"); void qc.invalidateQueries({ queryKey: ["admin-users"] }); }
  };

  if (!canAccess) {
    return <div className="text-muted-foreground">Apenas administradores podem gerenciar usuários.</div>;
  }
  if (!isPlatformAdmin && !scopedClientId) {
    return <div className="text-muted-foreground">Você precisa estar associado a um cliente.</div>;
  }

  const createUser = useServerFn(createClientUser);
  const updateUser = useServerFn(updateClientUser);
  const setPassword = useServerFn(updateUserPassword);

  type EditingUser = {
    id: string;
    full_name: string | null;
    email: string;
    client_id: string | null;
    group_id: string | null;
  };
  const [editing, setEditing] = useState<EditingUser | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editScope, setEditScope] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  const openEdit = (u: EditingUser) => {
    setEditing(u);
    setEditName(u.full_name ?? "");
    setEditEmail(u.email);
    setEditScope(u.client_id ? `client:${u.client_id}` : u.group_id ? `group:${u.group_id}` : "");
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSavingEdit(true);
    try {
      let clientId: string | null | undefined;
      let groupId: string | null | undefined;
      if (isPlatformAdmin) {
        if (editScope.startsWith("client:")) { clientId = editScope.slice(7); groupId = null; }
        else if (editScope.startsWith("group:")) { clientId = null; groupId = editScope.slice(6); }
        else { clientId = null; groupId = null; }
      }
      await updateUser({
        data: {
          targetUserId: editing.id,
          fullName: editName,
          email: editEmail,
          ...(isPlatformAdmin ? { clientId, groupId } : {}),
        },
      });
      toast.success("Usuário atualizado");
      setEditing(null);
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar");
    } finally {
      setSavingEdit(false);
    }
  };

  const [newEmail, setNewEmail] = useState("");
  const [newName, setNewName] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newScope, setNewScope] = useState("");
  const [newRole, setNewRole] = useState<"admin_platform" | "admin_client" | "admin_group" | "operator">("operator");
  const [creating, setCreating] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true);
    try {
      let clientId: string | null = null;
      let groupId: string | null = null;
      if (scopedClientId) {
        // admin_client: força escopo ao próprio cliente
        clientId = scopedClientId;
      } else if (newScope.startsWith("client:")) clientId = newScope.slice(7);
      else if (newScope.startsWith("group:")) groupId = newScope.slice(6);

      const effectiveRole = scopedClientId && newRole !== "admin_client" ? "operator" : newRole;

      if (effectiveRole === "admin_platform") {
        // server fn only accepts admin_client/group/operator; create as operator then add role
        await createUser({ data: { email: newEmail, fullName: newName, password: newPassword, role: "operator", clientId, groupId } });
        toast.success("Usuário criado. Adicione o papel Admin Plat. abaixo.");
      } else {
        await createUser({ data: { email: newEmail, fullName: newName, password: newPassword, role: effectiveRole, clientId, groupId } });
        toast.success("Usuário criado");
      }
      setNewEmail(""); setNewName(""); setNewPassword(""); setNewScope(""); setNewRole("operator");
      void qc.invalidateQueries({ queryKey: ["admin-users"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao criar usuário");
    } finally {
      setCreating(false);
    }
  };

  const [fleetUser, setFleetUser] = useState<{ id: string; name: string; client_id: string | null } | null>(null);
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPwValue, setResetPwValue] = useState("");
  const [savingReset, setSavingReset] = useState(false);

  const handleResetSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resettingId) return;
    setSavingReset(true);
    try {
      await setPassword({ data: { targetUserId: resettingId, password: resetPwValue } });
      toast.success("Senha atualizada");
      setResettingId(null);
      setResetPwValue("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha ao atualizar senha");
    } finally {
      setSavingReset(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Usuários</h1>
        <p className="text-sm text-muted-foreground">
          Defina o escopo de acesso (um cliente, um grupo de clientes ou plataforma) e os papéis de cada usuário.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Novo usuário</CardTitle></CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1"><Label>Nome</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} required /></div>
            <div className="space-y-1"><Label>Email</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} required /></div>
            <div className="space-y-1"><Label>Senha</Label><Input value={newPassword} onChange={(e) => setNewPassword(e.target.value)} minLength={8} required /></div>
            {isPlatformAdmin ? (
              <div className="space-y-1">
                <Label>Escopo</Label>
                <select className="h-9 w-full rounded border bg-background px-2 text-sm" value={newScope} onChange={(e) => setNewScope(e.target.value)}>
                  <option value="">Plataforma</option>
                  <optgroup label="Cliente">
                    {(clients ?? []).map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Grupo">
                    {(groups ?? []).map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                  </optgroup>
                </select>
              </div>
            ) : (
              <div className="space-y-1">
                <Label>Cliente</Label>
                <div className="flex h-9 items-center rounded border bg-muted px-2 text-sm text-muted-foreground">
                  {(clients ?? [])[0]?.name ?? "—"}
                </div>
              </div>
            )}
            <div className="space-y-1">
              <Label>Papel</Label>
              <select className="h-9 w-full rounded border bg-background px-2 text-sm" value={newRole} onChange={(e) => setNewRole(e.target.value as typeof newRole)}>
                <option value="operator">Operador</option>
                <option value="admin_client">Admin Cliente</option>
                {isPlatformAdmin && <option value="admin_group">Admin Grupo</option>}
                {isPlatformAdmin && <option value="admin_platform">Admin Plataforma</option>}
              </select>
            </div>
            <div className="flex items-end"><Button type="submit" disabled={creating} className="w-full">{creating ? "Criando..." : "Criar"}</Button></div>
          </form>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Escopo de acesso</TableHead>
                <TableHead>Papéis</TableHead>
                <TableHead>Adicionar papel</TableHead>
                <TableHead>Frotas responsáveis</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(users ?? []).map((u) => {
                const scopeValue = u.client_id ? `client:${u.client_id}` : u.group_id ? `group:${u.group_id}` : "";
                return (
                  <TableRow key={u.id}>
                    <TableCell>{u.full_name ?? "—"}</TableCell>
                    <TableCell className="text-sm">{u.email}</TableCell>
                    <TableCell>
                      {isPlatformAdmin ? (
                        <select
                          className="rounded border bg-background p-1 text-sm"
                          value={scopeValue}
                          onChange={(e) => setScope(u.id, e.target.value)}
                        >
                          <option value="">Plataforma / sem vínculo</option>
                          <optgroup label="Cliente único">
                            {(clients ?? []).map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}
                          </optgroup>
                          <optgroup label="Grupo de clientes">
                            {(groups ?? []).map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                          </optgroup>
                        </select>
                      ) : (
                        <span className="text-sm text-muted-foreground">
                          {u.client_name ?? "—"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="space-x-1 text-xs">
                      {u.roles.length === 0 && <span className="text-muted-foreground">—</span>}
                      {u.roles.map((r) => (
                        <button
                          key={r}
                          className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground hover:bg-destructive hover:text-destructive-foreground"
                          title="Clique para remover"
                          onClick={() => removeRole(u.id, r as AppRole)}
                        >
                          {r} ✕
                        </button>
                      ))}
                    </TableCell>
                    <TableCell className="space-x-1">
                      {isPlatformAdmin && <Button size="sm" variant="outline" onClick={() => assignRole(u.id, "admin_platform")}>+Admin Plat.</Button>}
                      {isPlatformAdmin && <Button size="sm" variant="outline" onClick={() => assignRole(u.id, "admin_group")}>+Admin Grupo</Button>}
                      <Button size="sm" variant="outline" onClick={() => assignRole(u.id, "admin_client")}>+Admin Cli.</Button>
                      <Button size="sm" variant="outline" onClick={() => assignRole(u.id, "operator")}>+Operador</Button>
                    </TableCell>
                    <TableCell className="space-x-1 text-xs">
                      {(fleetLinks ?? []).filter((l) => l.user_id === u.id).length === 0 ? (
                        <span className="text-muted-foreground">—</span>
                      ) : (
                        (fleetLinks ?? [])
                          .filter((l) => l.user_id === u.id)
                          .map((l) => (
                            <span key={l.id} className="rounded bg-secondary px-2 py-0.5 text-secondary-foreground">
                              {(fleets ?? []).find((f) => f.id === l.fleet_id)?.name ?? "frota"}
                            </span>
                          ))
                      )}
                    </TableCell>
                    <TableCell className="space-x-1">
                      <Button size="sm" variant="outline" onClick={() => openEdit({ id: u.id, full_name: u.full_name, email: u.email, client_id: u.client_id, group_id: u.group_id })}>Editar</Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setFleetUser({ id: u.id, name: u.full_name || u.email, client_id: u.client_id })}
                      >
                        Frotas
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setResettingId(u.id); setResetPwValue(""); }}>Reset senha</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuário</DialogTitle>
            <DialogDescription>Atualize nome, email e escopo de acesso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveEdit} className="space-y-3">
            <div className="space-y-1">
              <Label>Nome</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} required />
            </div>
            <div className="space-y-1">
              <Label>Email</Label>
              <Input type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} required />
            </div>
            {isPlatformAdmin ? (
              <div className="space-y-1">
                <Label>Escopo</Label>
                <select className="h-9 w-full rounded border bg-background px-2 text-sm" value={editScope} onChange={(e) => setEditScope(e.target.value)}>
                  <option value="">Plataforma / sem vínculo</option>
                  <optgroup label="Cliente único">
                    {(clients ?? []).map((c) => <option key={c.id} value={`client:${c.id}`}>{c.name}</option>)}
                  </optgroup>
                  <optgroup label="Grupo de clientes">
                    {(groups ?? []).map((g) => <option key={g.id} value={`group:${g.id}`}>{g.name}</option>)}
                  </optgroup>
                </select>
              </div>
            ) : null}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancelar</Button>
              <Button type="submit" disabled={savingEdit}>{savingEdit ? "Salvando..." : "Salvar"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={!!fleetUser} onOpenChange={(o) => !o && setFleetUser(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Frotas pelas quais {fleetUser?.name} é responsável</DialogTitle>
            <DialogDescription>
              Apenas frotas do mesmo cliente do usuário podem ser selecionadas. Ao remover o vínculo, o usuário perde
              imediatamente o acesso aos veículos e eventos daquela frota.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-80 space-y-2 overflow-auto">
            {!fleetUser?.client_id && (
              <p className="text-sm text-muted-foreground">
                Este usuário não está vinculado a um cliente. Defina o escopo do usuário para atribuir frotas.
              </p>
            )}
            {fleetUser?.client_id &&
              (fleets ?? []).filter((f) => f.client_id === fleetUser.client_id).length === 0 && (
                <p className="text-sm text-muted-foreground">Nenhuma frota cadastrada para este cliente.</p>
              )}
            {fleetUser?.client_id &&
              (fleets ?? [])
                .filter((f) => f.client_id === fleetUser.client_id)
                .map((f) => {
                  const checked = (fleetLinks ?? []).some((l) => l.user_id === fleetUser.id && l.fleet_id === f.id);
                  return (
                    <label key={f.id} className="flex items-center gap-2 rounded border p-2 text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => toggleFleetResponsible(fleetUser, f.id, e.target.checked)}
                      />
                      {f.name}
                    </label>
                  );
                })}
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={!!resettingId} onOpenChange={(o) => !o && setResettingId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
            <DialogDescription>Digite a nova senha para o usuário.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleResetSave} className="space-y-3">
            <div className="space-y-1">
              <Label>Nova senha</Label>
              <Input type="text" value={resetPwValue} onChange={(e) => setResetPwValue(e.target.value)} minLength={8} required />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setResettingId(null)}>Cancelar</Button>
              <Button type="submit" disabled={savingReset}>{savingReset ? "Salvando..." : "Salvar senha"}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
