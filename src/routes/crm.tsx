import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search,
  UserPlus,
  Phone,
  Mail,
  Building2,
  Loader2,
  Trash2,
  Edit,
  Users,
} from "lucide-react";

export const Route = createFileRoute("/crm")({
  component: CrmPage,
});

function CrmPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", companyId: "" });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["crm-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("*, companies(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAuthenticated,
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
    enabled: isAuthenticated,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.phone) throw new Error("Nome e telefone são obrigatórios");
      const { data: sess } = await supabase.auth.getSession();
      const payload = {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        notes: form.notes || "",
        company_id: form.companyId || null,
        created_by: sess.session?.user?.id || null,
      };

      if (editingContact) {
        const { error } = await supabase.from("crm_contacts").update(payload).eq("id", editingContact.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_contacts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingContact ? "Contato atualizado" : "Contato cadastrado");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_contacts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Contato removido");
      queryClient.invalidateQueries({ queryKey: ["crm-contacts"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover"),
  });

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "", notes: "", companyId: "" });
    setEditingContact(null);
  };

  const openEdit = (contact: any) => {
    setEditingContact(contact);
    setForm({
      name: contact.name,
      phone: contact.phone,
      email: contact.email || "",
      notes: contact.notes || "",
      companyId: contact.company_id || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (isLoading || !isAuthenticated) return null;

  const filtered = contacts.filter((c: any) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      c.name?.toLowerCase().includes(s) ||
      c.phone?.includes(s) ||
      c.email?.toLowerCase().includes(s) ||
      (c.companies as any)?.name?.toLowerCase().includes(s)
    );
  });

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">CRM - Contatos</h1>
            <p className="text-sm text-muted-foreground">
              {contacts.length} contato(s) cadastrado(s)
            </p>
          </div>
          <Button onClick={openNew}>
            <UserPlus className="h-4 w-4 mr-2" /> Novo Contato
          </Button>
        </div>

        <div className="relative max-w-sm">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, e-mail..."
            className="pl-8"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Observações</TableHead>
                  <TableHead className="w-24">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contactsLoading ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filtered.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                      Nenhum contato encontrado.
                    </TableCell>
                  </TableRow>
                ) : (
                  filtered.map((contact: any) => (
                    <TableRow key={contact.id}>
                      <TableCell className="font-medium">{contact.name}</TableCell>
                      <TableCell className="font-mono text-sm">{contact.phone}</TableCell>
                      <TableCell>{contact.email || "—"}</TableCell>
                      <TableCell>
                        {(contact.companies as any)?.name ? (
                          <Badge variant="secondary" className="text-xs gap-1">
                            <Building2 className="h-3 w-3" />
                            {(contact.companies as any).name}
                          </Badge>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                        {contact.notes || "—"}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(contact)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              if (confirm("Remover este contato?")) deleteMutation.mutate(contact.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* New/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato CRM"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Telefone *</Label>
              <Input value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Empresa vinculada</Label>
              <Select value={form.companyId} onValueChange={(v) => setForm((f) => ({ ...f, companyId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Nenhuma (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {companies.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.phone || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingContact ? "Salvar Alterações" : "Cadastrar Contato"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
