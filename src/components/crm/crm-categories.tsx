import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { Plus, Edit, Trash2, Loader2, Tag } from "lucide-react";

export function CrmCategories() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: "", description: "" });

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["crm-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_categories")
        .select("*")
        .order("name");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.name.trim()) throw new Error("Nome é obrigatório");
      if (editing) {
        const { error } = await supabase
          .from("crm_categories")
          .update({ name: form.name.trim(), description: form.description.trim() })
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("crm_categories")
          .insert({ name: form.name.trim(), description: form.description.trim() });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Categoria atualizada" : "Categoria criada");
      setDialogOpen(false);
      resetForm();
      queryClient.invalidateQueries({ queryKey: ["crm-categories"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Categoria removida");
      queryClient.invalidateQueries({ queryKey: ["crm-categories"] });
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao remover"),
  });

  const resetForm = () => {
    setForm({ name: "", description: "" });
    setEditing(null);
  };

  const openEdit = (cat: any) => {
    setEditing(cat);
    setForm({ name: cat.name, description: cat.description || "" });
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {categories.length} categoria(s) cadastrada(s)
        </p>
        <Button onClick={openNew} size="sm">
          <Plus className="h-4 w-4 mr-1" /> Nova Categoria
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="w-24">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : categories.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                    <Tag className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    Nenhuma categoria cadastrada.
                  </TableCell>
                </TableRow>
              ) : (
                categories.map((cat: any) => (
                  <TableRow key={cat.id}>
                    <TableCell className="font-medium">{cat.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{cat.description || "—"}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(cat)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm("Remover esta categoria?")) deleteMutation.mutate(cat.id);
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
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Categoria" : "Nova Categoria"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome *</Label>
              <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label>Descrição</Label>
              <Input value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
            </div>
            <Button
              className="w-full"
              onClick={() => saveMutation.mutate()}
              disabled={!form.name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar Categoria"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
