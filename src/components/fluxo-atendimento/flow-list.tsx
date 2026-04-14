import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, GitBranch } from "lucide-react";

type Flow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  created_at: string;
};

type Props = {
  onSelectFlow: (flow: Flow) => void;
  selectedFlowId?: string;
};

export function FlowList({ onSelectFlow, selectedFlowId }: Props) {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFlow, setEditingFlow] = useState<Flow | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["service-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_flows")
        .select("*")
        .order("name");
      if (error) throw error;
      return data as Flow[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (editingFlow) {
        const { error } = await supabase
          .from("service_flows")
          .update({ name, description, is_active: isActive })
          .eq("id", editingFlow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_flows")
          .insert({ name, description, is_active: isActive });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingFlow ? "Fluxo atualizado" : "Fluxo criado");
      queryClient.invalidateQueries({ queryKey: ["service-flows"] });
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_flows").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Fluxo removido");
      queryClient.invalidateQueries({ queryKey: ["service-flows"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreate = () => {
    setEditingFlow(null);
    setName("");
    setDescription("");
    setIsActive(true);
    setDialogOpen(true);
  };

  const openEdit = (flow: Flow) => {
    setEditingFlow(flow);
    setName(flow.name);
    setDescription(flow.description || "");
    setIsActive(flow.is_active);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFlow(null);
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <GitBranch className="h-4 w-4" /> Tipos de Fluxo
          </CardTitle>
          <Button size="sm" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Novo Fluxo
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : flows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhum fluxo cadastrado. Crie o primeiro fluxo para começar.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Descrição</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[120px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {flows.map((flow) => (
                  <TableRow
                    key={flow.id}
                    className={`cursor-pointer ${selectedFlowId === flow.id ? "bg-accent" : ""}`}
                    onClick={() => onSelectFlow(flow)}
                  >
                    <TableCell className="font-medium">{flow.name}</TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-[300px] truncate">
                      {flow.description || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={flow.is_active ? "default" : "secondary"}>
                        {flow.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(flow)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteMutation.mutate(flow.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
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

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingFlow ? "Editar Fluxo" : "Novo Fluxo"}</DialogTitle>
            <DialogDescription>
              {editingFlow ? "Atualize as informações do fluxo." : "Defina o nome e descrição do novo fluxo de atendimento."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Nome do Fluxo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Manutenção" />
            </div>
            <div>
              <Label>Descrição</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descreva o objetivo deste fluxo" rows={3} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={closeDialog}>Cancelar</Button>
              <Button onClick={() => saveMutation.mutate()} disabled={!name.trim() || saveMutation.isPending}>
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingFlow ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
