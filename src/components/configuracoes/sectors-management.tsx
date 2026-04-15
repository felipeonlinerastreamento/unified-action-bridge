import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Building2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Sector {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

export function SectorsManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Sector | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: sectors = [], isLoading } = useQuery({
    queryKey: ["local-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data as Sector[];
    },
  });

  const resetForm = () => { setName(""); setDescription(""); setIsActive(true); setEditing(null); };

  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (s: Sector) => {
    setEditing(s); setName(s.name); setDescription(s.description || ""); setIsActive(s.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome é obrigatório");
      const payload = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (editing) {
        const { error } = await supabase.from("sectors").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sectors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Setor atualizado" : "Setor criado");
      queryClient.invalidateQueries({ queryKey: ["local-sectors"] });
      setDialogOpen(false); resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setor excluído");
      queryClient.invalidateQueries({ queryKey: ["local-sectors"] });
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("sectors").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["local-sectors"] }),
  });

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Setores Locais
              </CardTitle>
              <CardDescription>
                Cadastre setores de destino para usar nos encaminhamentos.
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Novo Setor
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : sectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum setor cadastrado. Clique em "Novo Setor" para começar.
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
                {sectors.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.description || "—"}</TableCell>
                    <TableCell>
                      <Switch
                        checked={s.is_active}
                        onCheckedChange={(checked) => toggleMutation.mutate({ id: s.id, active: checked })}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
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
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Setor" : "Novo Setor"}</DialogTitle>
            <DialogDescription>Preencha as informações do setor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Setor</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Financeiro" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do setor..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Setor ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>Cancelar</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
