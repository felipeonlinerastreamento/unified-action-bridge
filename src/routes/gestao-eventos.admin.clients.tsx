import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { ClientUsersDialog } from "@/components/ge/admin/client-users-dialog";
import { ClientEventTypesDialog } from "@/components/ge/admin/client-event-types-dialog";
import { ClientFeaturesDialog } from "@/components/ge/admin/client-features-dialog";

export const Route = createFileRoute("/gestao-eventos/admin/clients")({
  component: AdminClients,
});

type ApiType = "movias" | "yuv";

function AdminClients() {
  const { isPlatformAdmin, startImpersonation } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [usersDialog, setUsersDialog] = useState<{ id: string; name: string } | null>(null);
  const [typesDialog, setTypesDialog] = useState<{ id: string; name: string } | null>(null);
  const [featuresDialog, setFeaturesDialog] = useState<{ id: string; name: string } | null>(null);


  const accessClient = (id: string, clientName: string) => {
    startImpersonation({ id, name: clientName });
    void qc.invalidateQueries();
    toast.success(`Acesso remoto à base de ${clientName}`);
    void navigate({ to: "/gestao-eventos/eventos" });
  };


  const { data: clients } = useQuery({
    queryKey: ["admin-all-clients"],
    queryFn: async () =>
      (await supabase.from("ge_clients").select("*").eq("is_staging", false).order("name")).data ?? [],
  });

  const { data: groups } = useQuery({
    queryKey: ["client-groups-light"],
    queryFn: async () => (await supabase.from("ge_client_groups").select("id,name").order("name")).data ?? [],
  });

  // Cliente do Gestão (Empresas) correspondente: liga a Gestão de eventos ao mesmo cliente.
  const { data: empresas } = useQuery({
    queryKey: ["ge-empresas-gestao"],
    queryFn: async () => ((await (supabase as any).from("companies").select("id,name").order("name").limit(5000)).data ?? []) as { id: string; name: string }[],
  });
  const setEmpresa = async (clientId: string, companyId: string) => {
    const { error } = await (supabase as any).from("ge_clients").update({ company_id: companyId || null }).eq("id", clientId);
    if (error) { toast.error(error.message); return; }
    toast.success("Cliente do Gestão vinculado");
    qc.invalidateQueries({ queryKey: ["admin-all-clients"] });
  };

  const { data: mappings } = useQuery({
    queryKey: ["client-external-accounts"],
    queryFn: async () =>
      (await supabase.from("ge_client_external_accounts").select("client_id, api_type, external_account_id")).data ?? [],
  });

  if (!isPlatformAdmin) {
    return <div className="text-muted-foreground">Apenas administradores da plataforma podem gerenciar clientes.</div>;
  }

  const create = async () => {
    if (!name.trim()) return;
    const { error } = await supabase.from("ge_clients").insert({ name, email_contact: email || null });
    if (error) toast.error(error.message);
    else { setName(""); setEmail(""); void qc.invalidateQueries({ queryKey: ["admin-all-clients"] }); toast.success("Cliente criado"); }
  };

  const toggle = async (id: string, active: boolean) => {
    await supabase.from("ge_clients").update({ is_active: !active }).eq("id", id);
    void qc.invalidateQueries({ queryKey: ["admin-all-clients"] });
  };

  const setGroup = async (id: string, groupId: string) => {
    const { error } = await supabase.from("ge_clients").update({ group_id: groupId || null }).eq("id", id);
    if (error) toast.error(error.message);
    else { void qc.invalidateQueries({ queryKey: ["admin-all-clients"] }); toast.success("Grupo atualizado"); }
  };

  const getMapping = (clientId: string, apiType: ApiType): string =>
    (mappings ?? []).find((m) => m.client_id === clientId && m.api_type === apiType)?.external_account_id ?? "";

  const saveMapping = async (clientId: string, apiType: ApiType, value: string) => {
    const trimmed = value.trim();
    const existing = (mappings ?? []).find((m) => m.client_id === clientId && m.api_type === apiType);
    if (!trimmed) {
      if (existing) {
        await supabase.from("ge_client_external_accounts").delete().eq("client_id", clientId).eq("api_type", apiType);
      }
    } else if (existing) {
      if (existing.external_account_id === trimmed) return;
      await supabase
        .from("ge_client_external_accounts")
        .update({ external_account_id: trimmed })
        .eq("client_id", clientId)
        .eq("api_type", apiType);
    } else {
      await supabase
        .from("ge_client_external_accounts")
        .insert({ client_id: clientId, api_type: apiType, external_account_id: trimmed });
    }
    void qc.invalidateQueries({ queryKey: ["client-external-accounts"] });
    toast.success(`Código ${apiType.toUpperCase()} atualizado`);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Clientes</h1>
        <p className="text-sm text-muted-foreground">
          Empresas atendidas pela plataforma. Configure o <strong>código externo</strong> de cada API para que os
          eventos sejam roteados ao cliente correto.
        </p>
      </div>
      <Card>
        <CardHeader><CardTitle>Novo cliente</CardTitle></CardHeader>
        <CardContent className="flex gap-2">
          <Input placeholder="Nome" value={name} onChange={(e) => setName(e.target.value)} />
          <Input placeholder="Email de contato" value={email} onChange={(e) => setEmail(e.target.value)} />
          <Button onClick={create}>Criar</Button>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Grupo</TableHead>
                <TableHead>Cliente no Gestão</TableHead>
                <TableHead>Cód. Movias</TableHead>
                <TableHead>Cód. YUV</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(clients ?? []).map((c) => (
                <TableRow key={c.id}>
                  <TableCell>{c.name}</TableCell>
                  <TableCell>{c.email_contact ?? "—"}</TableCell>
                  <TableCell>
                    <select
                      className="rounded border bg-background p-1 text-sm"
                      value={c.group_id ?? ""}
                      onChange={(e) => setGroup(c.id, e.target.value)}
                    >
                      <option value="">Sem grupo</option>
                      {(groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                  </TableCell>
                  <TableCell>
                    <select
                      className="max-w-[220px] rounded border bg-background p-1 text-sm"
                      value={(c as any).company_id ?? ""}
                      onChange={(e) => setEmpresa(c.id, e.target.value)}
                    >
                      <option value="">— não vinculado —</option>
                      {(empresas ?? []).map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
                    </select>
                  </TableCell>
                  <TableCell>
                    <ExternalAccountInput
                      defaultValue={getMapping(c.id, "movias")}
                      onSave={(v) => saveMapping(c.id, "movias", v)}
                    />
                  </TableCell>
                  <TableCell>
                    <ExternalAccountInput
                      defaultValue={getMapping(c.id, "yuv")}
                      onSave={(v) => saveMapping(c.id, "yuv", v)}
                    />
                  </TableCell>
                  <TableCell>{c.is_active ? "Ativo" : "Inativo"}</TableCell>
                  <TableCell className="space-x-1">
                    <Button size="sm" onClick={() => accessClient(c.id, c.name)}>Acessar base</Button>
                    <Button size="sm" variant="outline" onClick={() => setUsersDialog({ id: c.id, name: c.name })}>Usuários</Button>
                    <Button size="sm" variant="outline" onClick={() => setTypesDialog({ id: c.id, name: c.name })}>Tipos</Button>
                    <Button size="sm" variant="outline" onClick={() => setFeaturesDialog({ id: c.id, name: c.name })}>Funcionalidades</Button>
                    <Button size="sm" variant="ghost" onClick={() => toggle(c.id, c.is_active)}>{c.is_active ? "Desativar" : "Ativar"}</Button>
                  </TableCell>

                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      {usersDialog && (
        <ClientUsersDialog
          clientId={usersDialog.id}
          clientName={usersDialog.name}
          open={!!usersDialog}
          onOpenChange={(o) => { if (!o) setUsersDialog(null); }}
        />
      )}
      {typesDialog && (
        <ClientEventTypesDialog
          clientId={typesDialog.id}
          clientName={typesDialog.name}
          open={!!typesDialog}
          onOpenChange={(o) => { if (!o) setTypesDialog(null); }}
        />
      )}
      {featuresDialog && (
        <ClientFeaturesDialog
          clientId={featuresDialog.id}
          clientName={featuresDialog.name}
          open={!!featuresDialog}
          onOpenChange={(o) => { if (!o) setFeaturesDialog(null); }}
        />
      )}
    </div>
  );
}

function ExternalAccountInput({ defaultValue, onSave }: { defaultValue: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(defaultValue);
  return (
    <Input
      className="h-8 w-32"
      value={v}
      placeholder="—"
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { if (v !== defaultValue) onSave(v); }}
    />
  );
}
