import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Package, Search, Plus, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/estoque")({
  component: EstoquePage,
});

type InventoryItem = {
  id: string;
  name: string;
  serial_number: string | null;
  status: "disponivel" | "vinculado";
  linked_to: string | null;
  category_id: string;
  created_at: string;
};

type Category = {
  id: string;
  name: string;
};

function EstoquePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) return;
    loadData();
  }, [isAuthenticated]);

  async function loadData() {
    setLoading(true);
    const [itemsRes, catsRes] = await Promise.all([
      supabase.from("inventory_items").select("*").order("created_at", { ascending: false }),
      supabase.from("inventory_categories").select("*"),
    ]);
    setItems((itemsRes.data as InventoryItem[]) || []);
    setCategories((catsRes.data as Category[]) || []);
    setLoading(false);
  }

  if (isLoading || !isAuthenticated) return null;

  const filteredItems = items.filter((item) => {
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.serial_number && item.serial_number.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesCategory = categoryFilter === "all" || item.category_id === categoryFilter;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const availableCount = items.filter((i) => i.status === "disponivel").length;
  const linkedCount = items.filter((i) => i.status === "vinculado").length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Estoque / Métrica</h1>
            <p className="text-sm text-muted-foreground">Gestão de equipamentos e chips</p>
          </div>
          <AddItemDialog categories={categories} onSuccess={loadData} />
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{items.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-emerald-600">Disponíveis</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-emerald-600">{availableCount}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-amber-600">Vinculados</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-amber-600">{linkedCount}</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Buscar por nome ou serial..." className="pl-8" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="disponivel">Disponível</SelectItem>
              <SelectItem value="vinculado">Vinculado</SelectItem>
            </SelectContent>
          </Select>
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Categoria" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Serial</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Vinculado a</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">Carregando...</TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                      Nenhum item encontrado. Cadastre itens de estoque.
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id}>
                      <TableCell className="font-medium">{item.name}</TableCell>
                      <TableCell className="font-mono text-xs">{item.serial_number || "—"}</TableCell>
                      <TableCell>{categories.find((c) => c.id === item.category_id)?.name || "—"}</TableCell>
                      <TableCell>
                        <Badge variant={item.status === "disponivel" ? "default" : "secondary"} className={item.status === "disponivel" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                          {item.status === "disponivel" ? "Disponível" : "Vinculado"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{item.linked_to || "—"}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}

function AddItemDialog({ categories, onSuccess }: { categories: Category[]; onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("inventory_items").insert({
      name: fd.get("name") as string,
      serial_number: (fd.get("serial") as string) || null,
      category_id: fd.get("category") as string,
    });
    if (error) {
      toast.error(error.message);
    } else {
      toast.success("Item cadastrado!");
      setOpen(false);
      onSuccess();
    }
    setSaving(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button><Plus className="h-4 w-4 mr-2" /> Novo Item</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cadastrar Item</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Nome</Label>
            <Input name="name" required />
          </div>
          <div className="space-y-2">
            <Label>Número de Série</Label>
            <Input name="serial" />
          </div>
          <div className="space-y-2">
            <Label>Categoria</Label>
            <Select name="category" required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Salvando..." : "Cadastrar"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
