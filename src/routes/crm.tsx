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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, UserPlus, Building2, Loader2, Trash2, Edit, Users, Tag,
  Cake, TrendingUp, ListTodo, Plus, X,
} from "lucide-react";
import { CrmCategories } from "@/components/crm/crm-categories";
import { CrmBirthdaysTab } from "@/components/crm/crm-birthdays-tab";
import { CrmPipelineTab } from "@/components/crm/crm-pipeline-tab";
import { CrmTasksTab } from "@/components/crm/crm-tasks-tab";

export const Route = createFileRoute("/crm")({
  component: CrmPage,
});

type ViewMode = "all" | "direct" | "subclients";

function CrmPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [companyFilter, setCompanyFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [typeFilter, setTypeFilter] = useState<"all" | "PF" | "PJ">("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);
  type ContractItem = { categoryId: string; quantity: number; activationValue: number; monthlyValue: number };
  const [form, setForm] = useState({ name: "", phone: "", email: "", notes: "", companyId: "", categoryId: "", contactType: "PF" as "PF" | "PJ", source: "", items: [] as ContractItem[] });

  const { data: contacts = [], isLoading: contactsLoading } = useQuery({
    queryKey: ["crm-contacts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_contacts")
        .select("*, companies(id, name, cnpj), crm_categories(name)")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAuthenticated,
  });

  const { data: subClients = [], isLoading: subClientsLoading } = useQuery({
    queryKey: ["crm-sub-clients"],
    queryFn: async () => {
      const { data } = await supabase
        .from("sub_clients")
        .select("*, companies(id, name, cnpj)")
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

  const { data: categories = [] } = useQuery({
    queryKey: ["crm-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("crm_categories").select("id, name").order("name");
      return data || [];
    },
    enabled: isAuthenticated,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name || !form.phone) throw new Error("Nome e telefone são obrigatórios");
      const { data: sess } = await supabase.auth.getSession();
      const items = form.contactType === "PJ" ? form.items.filter(i => i.categoryId) : [];
      const activationTotal = items.reduce((s, i) => s + (Number(i.activationValue) || 0) * (Number(i.quantity) || 0), 0);
      const monthlyTotal = items.reduce((s, i) => s + (Number(i.monthlyValue) || 0) * (Number(i.quantity) || 0), 0);
      const payload: any = {
        name: form.name,
        phone: form.phone,
        email: form.email || null,
        notes: form.notes || "",
        company_id: form.companyId || null,
        category_id: form.contactType === "PJ" ? (form.categoryId || null) : null,
        contact_type: form.contactType,
        contract_items: items,
        activation_total: activationTotal,
        monthly_total: monthlyTotal,
        contact_source: form.source || null,
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
    setForm({ name: "", phone: "", email: "", notes: "", companyId: "", categoryId: "", contactType: "PF", source: "", items: [] });
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
      categoryId: contact.category_id || "",
      contactType: (contact.contact_type === "PJ" ? "PJ" : "PF"),
      items: Array.isArray(contact.contract_items) ? contact.contract_items : [],
      source: contact.contact_source || "",
    });
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  if (isLoading || !isAuthenticated) return null;

  // Build unified rows: direct CRM contacts + sub-clients (referenced as "sub")
  type Row = {
    id: string;
    kind: "direct" | "sub";
    name: string;
    phone: string;
    email: string | null;
    notes: string | null;
    company: { id: string; name: string; cnpj?: string | null } | null;
    categoryName: string | null;
    raw: any;
  };

  const directRows: Row[] = contacts.map((c: any) => ({
    id: c.id,
    kind: "direct",
    name: c.name,
    phone: c.phone,
    email: c.email,
    notes: c.notes,
    company: c.companies ? { id: c.companies.id, name: c.companies.name, cnpj: c.companies.cnpj } : null,
    categoryName: c.crm_categories?.name || null,
    raw: c,
  }));

  const subRows: Row[] = subClients.map((s: any) => ({
    id: s.id,
    kind: "sub",
    name: s.name,
    phone: s.phone,
    email: s.email,
    notes: s.notes,
    company: s.companies ? { id: s.companies.id, name: s.companies.name, cnpj: s.companies.cnpj } : null,
    categoryName: null,
    raw: s,
  }));

  const baseRows: Row[] =
    viewMode === "direct" ? directRows :
    viewMode === "subclients" ? subRows :
    [...directRows, ...subRows];

  const filtered = baseRows.filter((r) => {
    if (companyFilter !== "all") {
      if (companyFilter === "none") {
        if (r.company) return false;
      } else if (r.company?.id !== companyFilter) {
        return false;
      }
    }
    if (categoryFilter !== "all") {
      if (categoryFilter === "none") {
        if (r.categoryName) return false;
      } else if (r.kind !== "direct" || r.raw.category_id !== categoryFilter) {
        return false;
      }
    }
    if (typeFilter !== "all") {
      // Sub-clients are always treated as PJ context (linked to a company)
      const rowType = r.kind === "direct" ? (r.raw.contact_type || "PF") : "PJ";
      if (rowType !== typeFilter) return false;
    }
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      r.name?.toLowerCase().includes(s) ||
      r.phone?.includes(s) ||
      r.email?.toLowerCase().includes(s) ||
      r.company?.name?.toLowerCase().includes(s)
    );
  });

  // Group by company for the "by company" view
  const groupedByCompany = (() => {
    const map = new Map<string, { company: Row["company"]; rows: Row[] }>();
    for (const r of filtered) {
      const key = r.company?.id || "__none__";
      if (!map.has(key)) map.set(key, { company: r.company, rows: [] });
      map.get(key)!.rows.push(r);
    }
    return Array.from(map.values()).sort((a, b) =>
      (a.company?.name || "Sem empresa").localeCompare(b.company?.name || "Sem empresa")
    );
  })();

  const totalDirect = contacts.length;
  const totalSubs = subClients.length;
  const isLoadingData = contactsLoading || subClientsLoading;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">CRM</h1>
        </div>

        <Tabs defaultValue="tarefas">
          <TabsList className="flex-wrap h-auto">
            <TabsTrigger value="tarefas" className="gap-1">
              <ListTodo className="h-4 w-4" /> Tarefas
            </TabsTrigger>
            <TabsTrigger value="pipeline" className="gap-1">
              <TrendingUp className="h-4 w-4" /> Pipeline
            </TabsTrigger>
            <TabsTrigger value="aniversarios" className="gap-1">
              <Cake className="h-4 w-4" /> Aniversários
            </TabsTrigger>
            <TabsTrigger value="contatos" className="gap-1">
              <Users className="h-4 w-4" /> Contatos
            </TabsTrigger>
            <TabsTrigger value="por-empresa" className="gap-1">
              <Building2 className="h-4 w-4" /> Por Empresa
            </TabsTrigger>
            <TabsTrigger value="categorias" className="gap-1">
              <Tag className="h-4 w-4" /> Categorias
            </TabsTrigger>
          </TabsList>

          <TabsContent value="tarefas" className="mt-4"><CrmTasksTab /></TabsContent>
          <TabsContent value="pipeline" className="mt-4"><CrmPipelineTab /></TabsContent>
          <TabsContent value="aniversarios" className="mt-4"><CrmBirthdaysTab /></TabsContent>

          <TabsContent value="contatos" className="space-y-4 mt-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span>{totalDirect} contato(s) direto(s)</span>
                <span>•</span>
                <span>{totalSubs} sub-cliente(s)</span>
              </div>
              <Button onClick={openNew}>
                <UserPlus className="h-4 w-4 mr-2" /> Novo Contato
              </Button>
            </div>

            <Card className="p-3">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                <div className="relative md:col-span-2">
                  <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, telefone, e-mail, empresa..."
                    className="pl-8"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as any)}>
                  <SelectTrigger>
                    <SelectValue placeholder="PF / PJ" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">PF e PJ</SelectItem>
                    <SelectItem value="PF">Pessoa Física (PF)</SelectItem>
                    <SelectItem value="PJ">Pessoa Jurídica (PJ)</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={companyFilter} onValueChange={setCompanyFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Empresa" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as empresas</SelectItem>
                    <SelectItem value="none">Sem empresa vinculada</SelectItem>
                    {companies.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                  <SelectTrigger>
                    <SelectValue placeholder="Categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todas as categorias</SelectItem>
                    <SelectItem value="none">Sem categoria</SelectItem>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-2 mt-3">
                <span className="text-xs text-muted-foreground">Origem:</span>
                <Button
                  size="sm"
                  variant={viewMode === "all" ? "default" : "outline"}
                  onClick={() => setViewMode("all")}
                  className="h-7 text-xs"
                >
                  Todos
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "direct" ? "default" : "outline"}
                  onClick={() => setViewMode("direct")}
                  className="h-7 text-xs"
                >
                  Contatos diretos
                </Button>
                <Button
                  size="sm"
                  variant={viewMode === "subclients" ? "default" : "outline"}
                  onClick={() => setViewMode("subclients")}
                  className="h-7 text-xs"
                >
                  Sub-clientes
                </Button>
              </div>
            </Card>

            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Empresa</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Observações</TableHead>
                      <TableHead className="w-24">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {isLoadingData ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nenhum contato encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((row) => (
                        <TableRow key={`${row.kind}-${row.id}`}>
                          <TableCell>
                            <div className="flex flex-col gap-1">
                              {row.kind === "direct" ? (
                                <Badge variant="default" className="text-[10px] w-fit">
                                  Direto
                                </Badge>
                              ) : (
                                <Badge variant="secondary" className="text-[10px] gap-1 w-fit">
                                  <Users className="h-3 w-3" /> Sub-cliente
                                </Badge>
                              )}
                              <Badge
                                variant="outline"
                                className="text-[10px] w-fit"
                              >
                                {row.kind === "direct" ? (row.raw.contact_type || "PF") : "PJ"}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium">{row.name}</TableCell>
                          <TableCell className="font-mono text-sm">{row.phone}</TableCell>
                          <TableCell>{row.email || "—"}</TableCell>
                          <TableCell>
                            {row.company?.name ? (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <Building2 className="h-3 w-3" />
                                {row.company.name}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell>
                            {row.categoryName ? (
                              <Badge variant="outline" className="text-xs gap-1">
                                <Tag className="h-3 w-3" />
                                {row.categoryName}
                              </Badge>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="max-w-[200px] truncate text-sm text-muted-foreground">
                            {row.notes || "—"}
                          </TableCell>
                          <TableCell>
                            {row.kind === "direct" ? (
                              <div className="flex gap-1">
                                <Button variant="ghost" size="icon" onClick={() => openEdit(row.raw)}>
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    if (confirm("Remover este contato?")) deleteMutation.mutate(row.id);
                                  }}
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[10px] text-muted-foreground">via Empresas</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="por-empresa" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Visualize todos os contatos diretos e sub-clientes agrupados pela empresa pai.
            </p>

            <div className="relative max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            {isLoadingData ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin" />
              </div>
            ) : groupedByCompany.length === 0 ? (
              <Card>
                <CardContent className="text-center py-8 text-muted-foreground">
                  <Building2 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  Nenhum resultado.
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {groupedByCompany.map((g) => (
                  <Card key={g.company?.id || "none"}>
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Building2 className="h-4 w-4 text-primary" />
                          <h3 className="font-semibold">
                            {g.company?.name || "Sem empresa vinculada"}
                          </h3>
                          {g.company?.cnpj && (
                            <span className="text-xs text-muted-foreground font-mono">
                              {g.company.cnpj}
                            </span>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {g.rows.length} contato(s)
                        </Badge>
                      </div>

                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead className="w-28">Tipo</TableHead>
                            <TableHead>Nome</TableHead>
                            <TableHead>Telefone</TableHead>
                            <TableHead>E-mail</TableHead>
                            <TableHead>Categoria/Obs.</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {g.rows.map((row) => (
                            <TableRow key={`${row.kind}-${row.id}`}>
                              <TableCell>
                                {row.kind === "direct" ? (
                                  <Badge variant="default" className="text-[10px]">Direto</Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px] gap-1">
                                    <Users className="h-3 w-3" /> Sub
                                  </Badge>
                                )}
                              </TableCell>
                              <TableCell className="font-medium">{row.name}</TableCell>
                              <TableCell className="font-mono text-sm">{row.phone}</TableCell>
                              <TableCell className="text-sm">{row.email || "—"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground max-w-[260px] truncate">
                                {row.categoryName || row.notes || "—"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="categorias" className="mt-4">
            <CrmCategories />
          </TabsContent>
        </Tabs>
      </div>

      {/* New/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) resetForm(); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContact ? "Editar Contato" : "Novo Contato CRM"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Tipo de contato *</Label>
              <div className="flex gap-2 mt-1">
                <Button
                  type="button"
                  size="sm"
                  variant={form.contactType === "PF" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setForm((f) => ({ ...f, contactType: "PF", categoryId: "" }))}
                >
                  Pessoa Física (PF)
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={form.contactType === "PJ" ? "default" : "outline"}
                  className="flex-1"
                  onClick={() => setForm((f) => ({ ...f, contactType: "PJ" }))}
                >
                  Pessoa Jurídica (PJ)
                </Button>
              </div>
            </div>
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
            {form.contactType === "PJ" && (
              <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    Categorias PJ
                  </Label>
                  <span className="text-[10px] text-muted-foreground">
                    Gerencie em "Categorias"
                  </span>
                </div>
                <Select value={form.categoryId} onValueChange={(v) => setForm((f) => ({ ...f, categoryId: v }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione uma categoria PJ" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground">
                        Nenhuma categoria cadastrada. Use a aba "Categorias".
                      </div>
                    ) : (
                      categories.map((c: any) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  Categorias só se aplicam a Pessoa Jurídica. Para criar, editar ou excluir, abra a aba <strong>Categorias</strong>.
                </p>

                <div className="pt-2 mt-2 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                      Itens contratados
                    </Label>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          items: [...f.items, { categoryId: "", quantity: 1, activationValue: 0, monthlyValue: 0 }],
                        }))
                      }
                    >
                      <Plus className="h-3 w-3 mr-1" /> Adicionar item
                    </Button>
                  </div>

                  {form.items.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground italic">
                      Nenhum item adicionado. Use "Adicionar item" para registrar serviços contratados com valor de ativação e mensalidade.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {form.items.map((it, idx) => (
                        <div key={idx} className="grid grid-cols-12 gap-2 items-end rounded-md border border-border bg-background p-2">
                          <div className="col-span-12 sm:col-span-4">
                            <Label className="text-[10px] text-muted-foreground">Categoria</Label>
                            <Select
                              value={it.categoryId}
                              onValueChange={(v) =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.map((x, i) => (i === idx ? { ...x, categoryId: v } : x)),
                                }))
                              }
                            >
                              <SelectTrigger className="h-8 text-xs">
                                <SelectValue placeholder="Selecionar" />
                              </SelectTrigger>
                              <SelectContent>
                                {categories.map((c: any) => (
                                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Qtd.</Label>
                            <Input
                              type="number"
                              min={1}
                              className="h-8 text-xs"
                              value={it.quantity}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.map((x, i) => (i === idx ? { ...x, quantity: Number(e.target.value) || 0 } : x)),
                                }))
                              }
                            />
                          </div>
                          <div className="col-span-4 sm:col-span-2">
                            <Label className="text-[10px] text-muted-foreground">Ativação (R$)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-8 text-xs"
                              value={it.activationValue}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.map((x, i) => (i === idx ? { ...x, activationValue: Number(e.target.value) || 0 } : x)),
                                }))
                              }
                            />
                          </div>
                          <div className="col-span-3 sm:col-span-3">
                            <Label className="text-[10px] text-muted-foreground">Mensalidade (R$)</Label>
                            <Input
                              type="number"
                              min={0}
                              step="0.01"
                              className="h-8 text-xs"
                              value={it.monthlyValue}
                              onChange={(e) =>
                                setForm((f) => ({
                                  ...f,
                                  items: f.items.map((x, i) => (i === idx ? { ...x, monthlyValue: Number(e.target.value) || 0 } : x)),
                                }))
                              }
                            />
                          </div>
                          <div className="col-span-1">
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() =>
                                setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))
                              }
                            >
                              <X className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      <div className="flex items-center justify-end gap-4 text-xs pt-1">
                        <span className="text-muted-foreground">
                          Total Ativação:{" "}
                          <strong className="text-foreground">
                            R$ {form.items.reduce((s, i) => s + (Number(i.activationValue) || 0) * (Number(i.quantity) || 0), 0).toFixed(2)}
                          </strong>
                        </span>
                        <span className="text-muted-foreground">
                          Total Mensal:{" "}
                          <strong className="text-foreground">
                            R$ {form.items.reduce((s, i) => s + (Number(i.monthlyValue) || 0) * (Number(i.quantity) || 0), 0).toFixed(2)}
                          </strong>
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
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
