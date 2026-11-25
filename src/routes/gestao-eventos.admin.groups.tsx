import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao-eventos/admin/groups")({
  component: AdminGroups,
});

function AdminGroups() {
  const { isPlatformAdmin } = useAuth();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: groups } = useQuery({
    queryKey: ["admin-client-groups"],
    queryFn: async () => (await supabase.from("ge_client_groups").select("*").order("name")).data ?? [],
  });

  const { data: clients } = useQuery({
    queryKey: ["admin-clients-with-group"],
    queryFn: async () => (await supabase.from("ge_clients").select("id,name,group_id,is_active").order("name")).data ?? [],
  });

  if (!isPlatformAdmin) {
    return <div className="text-muted-foreground">Apenas administradores da plataforma podem gerenciar grupos.</div>;
  }

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("ge_client_groups").insert({ name, description: description || null });
    if (error) toast.error(error.message);
    else {
      setName(""); setDescription("");
      void qc.invalidateQueries({ queryKey: ["admin-client-groups"] });
      toast.success("Grupo criado");
    }
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("ge_client_groups").update({ is_active: !active }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["admin-client-groups"] });
  };

  const setClientGroup = async (clientId: string, groupId: string) => {
    const { error } = await supabase.from("ge_clients").update({ group_id: groupId || null }).eq("id", clientId);
    if (error) toast.error(error.message);
    else { toast.success("Cliente atualizado"); void qc.invalidateQueries({ queryKey: ["admin-clients-with-group"] }); }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Grupos de Clientes</h1>
        <p className="text-sm text-muted-foreground">Agrupe clientes (ex.: holdings) para liberar acesso multi-cliente aos usuários</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Novo grupo</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nome do grupo" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} />
          <Button onClick={create}>Criar</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Grupos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead><TableHead>Descrição</TableHead><TableHead>Clientes</TableHead><TableHead>Status</TableHead><TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(groups ?? []).map((g) => {
                const members = (clients ?? []).filter((c) => c.group_id === g.id);
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">{g.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{g.description ?? "—"}</TableCell>
                    <TableCell className="text-sm">{members.length}</TableCell>
                    <TableCell>{g.is_active ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="ghost" onClick={() => toggle(g.id, g.is_active)}>
                        {g.is_active ? "Desativar" : "Ativar"}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(groups ?? []).length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground">Nenhum grupo cadastrado.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Atribuir clientes a grupos</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead><TableHead>Grupo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>
                    <select
                      className="rounded border bg-background p-1 text-sm"
                      value={c.group_id ?? ""}
                      onChange={(e) => setClientGroup(c.id, e.target.value)}
                    >
                      <option value="">Sem grupo</option>
                      {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
