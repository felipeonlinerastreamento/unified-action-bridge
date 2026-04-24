import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Package, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

interface CatalogItem {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export function LiberacaoEquipamentoConfig() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["liberacao-equipamento-catalog-config"],
    queryFn: async (): Promise<CatalogItem[]> => {
      const { data, error } = await supabase
        .from("liberacao_equipamento_items" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const reset = () => {
    setEditing(null);
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const openCreate = () => {
    reset();
    setDialogOpen(true);
  };

  const openEdit = (item: CatalogItem) => {
    setEditing(item);
    setName(item.name);
    setDescription(item.description || "");
    setIsActive(item.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do item");
      const payload = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (editing) {
        const { error } = await supabase
          .from("liberacao_equipamento_items" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("liberacao_equipamento_items" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Item atualizado" : "Item criado");
      qc.invalidateQueries({ queryKey: ["liberacao-equipamento-catalog-config"] });
      qc.invalidateQueries({ queryKey: ["liberacao-equipamento-catalog"] });
      setDialogOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("liberacao_equipamento_items" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item excluído");
      qc.invalidateQueries({ queryKey: ["liberacao-equipamento-catalog-config"] });
      qc.invalidateQueries({ queryKey: ["liberacao-equipamento-catalog"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Liberação de Equipamento — Itens
          </CardTitle>
          <CardDescription>
            Catálogo de itens que podem ser liberados (rastreador, chip, antena, etc.).
            Esses itens aparecerão ao abrir/finalizar atendimentos da categoria
            "Liberação de Equipamento".
          </CardDescription>
        </div>
        <Button size="sm" onClick={openCreate}>
          <Plus className="h-4 w-4 mr-1" /> Novo item
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Nenhum item cadastrado. Clique em "Novo item" para começar.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ativo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {it.description || "—"}
                  </TableCell>
                  <TableCell>
                    {it.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                        Sim
                      </Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDeleteId(it.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={(o) => { if (!o) reset(); setDialogOpen(o); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar item" : "Novo item"}</DialogTitle>
            <DialogDescription>
              Defina nome e descrição do item de liberação.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Rastreador" />
            </div>
            <div className="space-y-1">
              <Label>Descrição</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Detalhes do item (opcional)"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Item ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); reset(); }}>
              Cancelar
            </Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir item?</AlertDialogTitle>
            <AlertDialogDescription>
              O item será removido do catálogo. Itens já vinculados a chamados
              continuarão registrados pelo nome.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
