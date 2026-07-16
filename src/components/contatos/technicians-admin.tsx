import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, Loader2, Pencil, Trash2, Wrench, RefreshCw, Plus, MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ContactChatActions } from "@/components/contatos/contact-chat-actions";

type Technician = {
  id: string;
  contact_phone: string;
  name: string;
  phone: string | null;
  address: string | null;
  city_state: string | null;
  notes: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

type FormState = {
  name: string;
  phone: string;
  address: string;
  city_state: string;
  notes: string;
  contact_phone: string;
};

const emptyForm: FormState = { name: "", phone: "", address: "", city_state: "", notes: "", contact_phone: "" };

export function TechniciansAdmin() {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<Technician | null>(null);
  const [creating, setCreating] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const { data = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ["technicians-admin"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("chat_technicians" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return (data || []) as unknown as Technician[];
    },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return data;
    const term = search.toLowerCase().trim();
    const digits = term.replace(/\D/g, "");
    return data.filter(
      (t) =>
        t.name?.toLowerCase().includes(term) ||
        (t.phone || "").toLowerCase().includes(term) ||
        (digits && (t.contact_phone || "").includes(digits)) ||
        (t.address || "").toLowerCase().includes(term) ||
        (t.city_state || "").toLowerCase().includes(term),
    );
  }, [data, search]);

  const openCreate = () => {
    setForm(emptyForm);
    setCreating(true);
  };

  const openEdit = (t: Technician) => {
    setEditing(t);
    setForm({
      name: t.name || "",
      phone: t.phone || "",
      address: t.address || "",
      city_state: t.city_state || "",
      notes: t.notes || "",
      contact_phone: t.contact_phone || "",
    });
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      if (!name) throw new Error("Nome obrigatório");
      if (name.length > 120) throw new Error("Nome muito longo");
      const contactDigits = (form.contact_phone || form.phone).replace(/\D/g, "");
      if (!contactDigits) throw new Error("Informe o telefone do contato vinculado");
      const { error } = await supabase.from("chat_technicians" as any).insert({
        contact_phone: contactDigits,
        name,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
        city_state: form.city_state.trim() || null,
        notes: form.notes.trim() || null,
        created_by: user?.id || null,
        created_by_name: profile?.name || user?.email || null,
        updated_by: user?.id || null,
        updated_by_name: profile?.name || user?.email || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Técnico cadastrado");
      setCreating(false);
      setForm(emptyForm);
      queryClient.invalidateQueries({ queryKey: ["technicians-admin"] });
      queryClient.invalidateQueries({ queryKey: ["chat-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao cadastrar"),
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editing) throw new Error("Sem técnico selecionado");
      const name = form.name.trim();
      if (!name) throw new Error("Nome obrigatório");
      if (name.length > 120) throw new Error("Nome muito longo");
      const { error } = await supabase
        .from("chat_technicians" as any)
        .update({
          name,
          phone: form.phone.trim() || null,
          address: form.address.trim() || null,
          city_state: form.city_state.trim() || null,
          notes: form.notes.trim() || null,
          updated_by: user?.id || null,
          updated_by_name: profile?.name || user?.email || null,
        } as any)
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Técnico atualizado");
      setEditing(null);
      queryClient.invalidateQueries({ queryKey: ["technicians-admin"] });
      queryClient.invalidateQueries({ queryKey: ["chat-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("chat_technicians" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Técnico removido");
      setDeleteId(null);
      queryClient.invalidateQueries({ queryKey: ["technicians-admin"] });
      queryClient.invalidateQueries({ queryKey: ["chat-technicians"] });
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const FormFields = (
    <div className="space-y-2">
      <div>
        <Label className="text-xs">Nome *</Label>
        <Input
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          maxLength={120}
        />
      </div>
      <div>
        <Label className="text-xs">Telefone</Label>
        <Input
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          maxLength={40}
        />
      </div>
      <div>
        <Label className="text-xs">Endereço</Label>
        <Input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          maxLength={300}
        />
      </div>
      <div>
        <Label className="text-xs">Cidade/Estado</Label>
        <Input
          value={form.city_state}
          onChange={(e) => setForm((f) => ({ ...f, city_state: e.target.value }))}
          placeholder="Belo Horizonte/MG"
          maxLength={120}
        />
      </div>
      <div>
        <Label className="text-xs">Observação</Label>
        <Textarea
          rows={3}
          value={form.notes}
          onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          maxLength={1000}
        />
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{filtered.length} técnico(s)</p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          </Button>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-4 w-4 mr-1" /> Novo técnico
          </Button>
        </div>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, endereço, cidade..."
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
                <TableHead>Endereço</TableHead>
                <TableHead>Cidade/Estado</TableHead>
                <TableHead>Observação</TableHead>
                <TableHead>Tel. do contato</TableHead>
                <TableHead>Atualizado</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-10 text-muted-foreground">
                    <Wrench className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum técnico cadastrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell className="font-mono text-sm">{t.phone || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate" title={t.address || ""}>
                      {t.address || "—"}
                    </TableCell>
                    <TableCell className="max-w-[12rem] truncate" title={t.city_state || ""}>
                      {t.city_state || "—"}
                    </TableCell>
                    <TableCell className="max-w-xs truncate" title={t.notes || ""}>
                      {t.notes || "—"}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {t.contact_phone}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {new Date(t.updated_at).toLocaleString("pt-BR")}
                      {t.updated_by_name && <div className="text-[10px]">por {t.updated_by_name}</div>}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(t)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeleteId(t.id)}
                          title="Remover"
                        >
                          <Trash2 className="h-4 w-4" />
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

      <Dialog open={creating} onOpenChange={(o) => { if (!o) { setCreating(false); setForm(emptyForm); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Novo técnico</DialogTitle>
            <DialogDescription>
              Cadastre um técnico vinculado a um número de contato.
            </DialogDescription>
          </DialogHeader>
          <ContactChatActions
            phone={form.phone || form.contact_phone}
            name={form.name}
            onNavigate={() => { setCreating(false); setForm(emptyForm); }}
          />
          <div className="space-y-2">
            <div>
              <Label className="text-xs">Telefone do contato vinculado *</Label>
              <Input
                value={form.contact_phone}
                onChange={(e) => setForm((f) => ({ ...f, contact_phone: e.target.value }))}
                placeholder="Ex.: 5531999999999 (apenas dígitos)"
                maxLength={40}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Número do WhatsApp/contato onde o técnico aparecerá. Se vazio, usa o telefone abaixo.
              </p>
            </div>
            {FormFields}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setCreating(false); setForm(emptyForm); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name.trim() || createMutation.isPending}
            >
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Cadastrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Editar técnico</DialogTitle>
          </DialogHeader>
          <ContactChatActions
            phone={form.phone || form.contact_phone}
            name={form.name}
            onNavigate={() => setEditing(null)}
          />
          {FormFields}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancelar
            </Button>
            <Button
              onClick={() => updateMutation.mutate()}
              disabled={!form.name.trim() || updateMutation.isPending}
            >
              {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover técnico?</AlertDialogTitle>
            <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
