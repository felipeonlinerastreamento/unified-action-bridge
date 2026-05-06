import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { PackageX, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { formatBRL, type PerdidosCatalogItem } from "@/hooks/use-perdidos";

export function PerdidosConfig() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<PerdidosCatalogItem | null>(null);
  const [name, setName] = useState("");
  const [defaultQty, setDefaultQty] = useState(1);
  const [defaultUnitValue, setDefaultUnitValue] = useState(0);
  const [isActive, setIsActive] = useState(true);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["perdidos-catalog-config"],
    queryFn: async (): Promise<PerdidosCatalogItem[]> => {
      const { data, error } = await supabase
        .from("perdidos_items" as any)
        .select("*")
        .order("name");
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const reset = () => {
    setEditing(null);
    setName("");
    setDefaultQty(1);
    setDefaultUnitValue(0);
    setIsActive(true);
  };

  const openCreate = () => {
    reset();
    setDialogOpen(true);
  };

  const openEdit = (item: PerdidosCatalogItem) => {
    setEditing(item);
    setName(item.name);
    setDefaultQty(item.default_quantity || 1);
    setDefaultUnitValue(Number(item.default_unit_value) || 0);
    setIsActive(item.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Informe o nome do item");
      const payload = {
        name: name.trim(),
        default_quantity: Math.max(1, defaultQty),
        default_unit_value: Math.max(0, defaultUnitValue),
        is_active: isActive,
      };
      if (editing) {
        const { error } = await supabase
          .from("perdidos_items" as any)
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("perdidos_items" as any)
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Item atualizado" : "Item criado");
      qc.invalidateQueries({ queryKey: ["perdidos-catalog-config"] });
      qc.invalidateQueries({ queryKey: ["perdidos-catalog"] });
      setDialogOpen(false);
      reset();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("perdidos_items" as any)
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Item excluído");
      qc.invalidateQueries({ queryKey: ["perdidos-catalog-config"] });
      qc.invalidateQueries({ queryKey: ["perdidos-catalog"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <PackageX className="h-5 w-5" />
            Itens Perdidos
          </CardTitle>
          <CardDescription>
            Catálogo de itens. Aparecem ao abrir/atender chamados da categoria
            "Perdidos".
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
            Nenhum item cadastrado.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead className="w-[120px]">Qtd. Padrão</TableHead>
                <TableHead className="w-[140px]">Valor unitário</TableHead>
                <TableHead className="w-[80px]">Ativo</TableHead>
                <TableHead className="w-[100px]">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((it) => (
                <TableRow key={it.id}>
                  <TableCell className="font-medium">{it.name}</TableCell>
                  <TableCell>{it.default_quantity}</TableCell>
                  <TableCell>{formatBRL(it.default_unit_value)}</TableCell>
                  <TableCell>
                    {it.is_active ? (
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Sim</Badge>
                    ) : (
                      <Badge variant="secondary">Não</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(it)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(it.id)}>
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
            <DialogTitle>{editing ? "Editar item" : "Novo item perdido"}</DialogTitle>
            <DialogDescription>
              Defina o nome, quantidade e valor unitário sugeridos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nome *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Chave do veículo" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Quantidade padrão</Label>
                <Input
                  type="number"
                  min={1}
                  value={defaultQty}
                  onChange={(e) => setDefaultQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
                />
              </div>
              <div className="space-y-1">
                <Label>Valor unitário (R$)</Label>
                <Input
                  type="number"
                  min={0}
                  step="0.01"
                  value={defaultUnitValue}
                  onChange={(e) => setDefaultUnitValue(Math.max(0, parseFloat(e.target.value) || 0))}
                />
              </div>
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
