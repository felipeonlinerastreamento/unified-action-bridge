import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { ContactChatActions } from "@/components/contatos/contact-chat-actions";
import {
  Search, UserPlus, Building2, Loader2, Trash2, Edit, Users, Phone, Check, ChevronsUpDown,
} from "lucide-react";

export function SubClientsAdmin() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", companyId: "" });
  const [companyOpen, setCompanyOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  const { data: subClients = [], isLoading } = useQuery({
    queryKey: ["sub-clients-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sub_clients")
        .select("*, companies(id, name)")
        .order("name");
      return data || [];
    },
  });

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-list"],
    queryFn: async () => {
      // PostgREST limita a 1000 linhas por requisição: paginar explicitamente.
      const rows: any[] = [];
      const page = 1000;
      for (let from = 0; from < 10000; from += page) {
        const { data, error } = await supabase
          .from("companies")
          .select("id, name")
          .order("name")
          .range(from, from + page - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        rows.push(...data);
        if (data.length < page) break;
      }
      return rows;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.phone || !form.companyId) {
        throw new Error("Nome, telefone e empresa são obrigatórios");
      }
      const { data: sess } = await supabase.auth.getSession();
      const payload = {
        name: form.name.trim(),
        phone: form.phone.replace(/\D/g, ""),
        email: form.email || null,
        notes: form.notes || "",
        company_id: form.companyId,
        created_by: sess.session?.user?.id || null,
      };

      if (editing) {
        const { error } = await supabase.from("sub_clients").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sub_clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Sub-cliente atualizado" : "Sub-cliente cadastrado");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["sub-clients-admin"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sub_clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-cliente removido");
      queryClient.invalidateQueries({ queryKey: ["sub-clients-admin"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover"),
  });

  const resetForm = () => {
    setForm({ name: "", phone: "", email: "", notes: "", companyId: "" });
    setEditing(null);
  };

  const openEdit = (sub: any) => {
    setEditing(sub);
    setForm({
      name: sub.name,
      phone: sub.phone,
      email: sub.email || "",
      notes: sub.notes || "",
      companyId: sub.company_id,
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  const filtered = subClients.filter((s: any) => {
    if (!search) return true;
    const term = search.toLowerCase();
    return (
      s.name?.toLowerCase().includes(term) ||
      s.phone?.includes(term) ||
      s.email?.toLowerCase().includes(term) ||
      (s.companies as any)?.name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {subClients.length} sub-cliente(s) cadastrado(s)
        </p>
        <Button onClick={openNew} size="sm">
          <UserPlus className="h-4 w-4 mr-2" /> Novo Sub-cliente
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, empresa..."
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
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhum sub-cliente encontrado.
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((sub: any) => (
                  <TableRow key={sub.id}>
                    <TableCell className="font-medium">{sub.name}</TableCell>
                    <TableCell className="font-mono text-sm">{sub.phone}</TableCell>
                    <TableCell>{sub.email || "—"}</TableCell>
                    <TableCell>
                      {(sub.companies as any)?.name ? (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <Building2 className="h-3 w-3" />
                          {(sub.companies as any).name}
                        </Badge>
                      ) : "—"}
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-sm text-muted-foreground">
                      {sub.notes || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(sub)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Remover este sub-cliente?")) deleteMutation.mutate(sub.id);
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

      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Sub-cliente" : "Novo Sub-cliente"}</DialogTitle>
          </DialogHeader>
          <ContactChatActions
            phone={form.phone}
            name={form.name}
            onNavigate={() => { setDialogOpen(false); resetForm(); }}
          />
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
              <Label>Cliente responsável (empresa) *</Label>
              <Popover open={companyOpen} onOpenChange={setCompanyOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" className="w-full justify-between font-normal">
                    <span className="truncate">
                      {form.companyId
                        ? companies.find((c: any) => c.id === form.companyId)?.name || "Empresa selecionada"
                        : "Buscar e selecionar empresa..."}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-2" align="start">
                  <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      autoFocus
                      placeholder="Digite o nome da empresa..."
                      className="pl-8"
                      value={companySearch}
                      onChange={(e) => setCompanySearch(e.target.value)}
                    />
                  </div>
                  <ScrollArea className="h-56">
                    {companies
                      .filter((c: any) =>
                        !companySearch.trim() ||
                        c.name?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
                          .includes(companySearch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
                      )
                      .slice(0, 100)
                      .map((c: any) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setForm((f) => ({ ...f, companyId: c.id }));
                            setCompanyOpen(false);
                            setCompanySearch("");
                          }}
                          className="w-full flex items-center gap-2 text-left px-2 py-1.5 rounded text-sm hover:bg-accent/60"
                        >
                          <Check className={`h-4 w-4 shrink-0 ${form.companyId === c.id ? "opacity-100 text-primary" : "opacity-0"}`} />
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">{c.name}</span>
                        </button>
                      ))}
                    {companies.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-4">
                        Nenhuma empresa carregada.
                      </p>
                    )}
                    {companies.length > 0 && companySearch &&
                      companies.filter((c: any) =>
                        c.name?.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
                          .includes(companySearch.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, ""))
                      ).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">
                          Nenhuma empresa encontrada para "{companySearch}".
                        </p>
                      )}
                  </ScrollArea>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>E-mail</Label>
              <Input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} />
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea rows={3} value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name || !form.phone || !form.companyId || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar Alterações" : "Cadastrar Sub-cliente"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}