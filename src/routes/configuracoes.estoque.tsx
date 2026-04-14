import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";

export const Route = createFileRoute("/configuracoes/estoque")({
  component: EstoqueConfigPage,
});

function EstoqueConfigPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Estoque</h1>
          <p className="text-sm text-muted-foreground">Configurações de estoque mínimo e categorias</p>
        </div>
        <Tabs defaultValue="stock-rules">
          <TabsList>
            <TabsTrigger value="stock-rules">Estoque Mínimo</TabsTrigger>
            <TabsTrigger value="categories">Categorias</TabsTrigger>
          </TabsList>
          <TabsContent value="stock-rules" className="mt-4"><StockRulesConfig /></TabsContent>
          <TabsContent value="categories" className="mt-4"><CategoriesConfig /></TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function StockRulesConfig() {
  const [rules, setRules] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadRules(); }, []);

  async function loadRules() {
    const { data } = await supabase.from("inventory_min_rules").select("*");
    setRules(data || []);
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("inventory_min_rules").insert({
      item_name: fd.get("item_name") as string,
      min_quantity: Number(fd.get("min_quantity")),
      auto_ticket: true,
    });
    if (error) toast.error(error.message);
    else { toast.success("Regra criada!"); setOpen(false); loadRules(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Regras de Estoque Mínimo</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Regra</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Regra de Mínimo</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2"><Label>Nome do Item</Label><Input name="item_name" required /></div>
              <div className="space-y-2"><Label>Quantidade Mínima</Label><Input name="min_quantity" type="number" min={1} required /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Criar Regra"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {rules.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma regra configurada</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Item</TableHead><TableHead>Qtd. Mínima</TableHead><TableHead>Ticket Automático</TableHead></TableRow></TableHeader>
            <TableBody>
              {rules.map((rule) => (
                <TableRow key={rule.id}>
                  <TableCell className="font-medium">{rule.item_name}</TableCell>
                  <TableCell>{rule.min_quantity}</TableCell>
                  <TableCell>{rule.auto_ticket ? "Sim" : "Não"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function CategoriesConfig() {
  const [categories, setCategories] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadCategories(); }, []);

  async function loadCategories() {
    const { data } = await supabase.from("inventory_categories").select("*");
    setCategories(data || []);
  }

  const handleAdd = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSaving(true);
    const fd = new FormData(e.currentTarget);
    const { error } = await supabase.from("inventory_categories").insert({
      name: fd.get("name") as string,
      description: (fd.get("description") as string) || null,
    });
    if (error) toast.error(error.message);
    else { toast.success("Categoria criada!"); setOpen(false); loadCategories(); }
    setSaving(false);
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-base">Categorias de Estoque</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Nova Categoria</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Nova Categoria</DialogTitle></DialogHeader>
            <form onSubmit={handleAdd} className="space-y-4">
              <div className="space-y-2"><Label>Nome</Label><Input name="name" required /></div>
              <div className="space-y-2"><Label>Descrição</Label><Input name="description" /></div>
              <Button type="submit" className="w-full" disabled={saving}>{saving ? "Salvando..." : "Criar"}</Button>
            </form>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        {categories.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">Nenhuma categoria criada</p>
        ) : (
          <Table>
            <TableHeader><TableRow><TableHead>Nome</TableHead><TableHead>Descrição</TableHead></TableRow></TableHeader>
            <TableBody>
              {categories.map((cat) => (
                <TableRow key={cat.id}>
                  <TableCell className="font-medium">{cat.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{cat.description || "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
