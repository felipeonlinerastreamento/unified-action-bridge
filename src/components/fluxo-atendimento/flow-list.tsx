import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getTiposPendencia } from "@/lib/gsystem-api.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Loader2, GitBranch, Search } from "lucide-react";

type Flow = {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  trigger_categories: string[];
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
  const [triggerCategories, setTriggerCategories] = useState<string[]>([]);
  const [categorySearch, setCategorySearch] = useState("");

  const { data: flows = [], isLoading } = useQuery({
    queryKey: ["service-flows"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_flows")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []).map((f: any) => ({
        ...f,
        trigger_categories: f.trigger_categories ?? [],
      })) as Flow[];
    },
  });

  const { data: tiposPendencia = [] } = useQuery({
    queryKey: ["tipos-pendencia-flow"],
    queryFn: async () => {
      try {
        const result = await getTiposPendencia();
        return Array.isArray(result) ? result : [];
      } catch {
        return [];
      }
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name,
        description,
        is_active: isActive,
        trigger_categories: triggerCategories,
      };
      if (editingFlow) {
        const { error } = await supabase
          .from("service_flows")
          .update(payload)
          .eq("id", editingFlow.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("service_flows")
          .insert(payload);
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
    setTriggerCategories([]);
    setCategorySearch("");
    setDialogOpen(true);
  };

  const openEdit = (flow: Flow) => {
    setEditingFlow(flow);
    setName(flow.name);
    setDescription(flow.description || "");
    setIsActive(flow.is_active);
    setTriggerCategories(flow.trigger_categories || []);
    setCategorySearch("");
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingFlow(null);
  };

  const toggleCategory = (key: string) => {
    setTriggerCategories((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  const filteredCategories = (Array.isArray(tiposPendencia) ? tiposPendencia : []).filter((t: any) =>
    !categorySearch || (t.Descricao || t.Key || "").toLowerCase().includes(categorySearch.toLowerCase())
  );

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
                  <TableHead>Categorias Vinculadas</TableHead>
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
                    <TableCell className="text-sm text-muted-foreground max-w-[200px] truncate">
                      {flow.description || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {(flow.trigger_categories || []).length === 0 ? (
                          <span className="text-xs text-muted-foreground">Nenhuma</span>
                        ) : (
                          flow.trigger_categories.slice(0, 3).map((cat) => (
                            <Badge key={cat} variant="outline" className="text-xs">
                              {cat}
                            </Badge>
                          ))
                        )}
                        {(flow.trigger_categories || []).length > 3 && (
                          <Badge variant="secondary" className="text-xs">
                            +{flow.trigger_categories.length - 3}
                          </Badge>
                        )}
                      </div>
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
        <DialogContent className="max-w-lg">
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
            <div>
              <Label>Categorias que ativam este fluxo</Label>
              <p className="text-xs text-muted-foreground mb-2">
                Ao finalizar um atendimento com uma dessas categorias, este fluxo será ativado automaticamente.
              </p>
              <div className="relative mb-2">
                <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={categorySearch}
                  onChange={(e) => setCategorySearch(e.target.value)}
                  placeholder="Buscar categoria..."
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <ScrollArea className="h-[150px] rounded-md border p-2">
                {filteredCategories.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-4">
                    {tiposPendencia.length === 0 ? "Nenhuma categoria disponível" : "Nenhum resultado"}
                  </p>
                ) : (
                  <div className="space-y-1">
                    {filteredCategories.map((tipo: any) => {
                      const key = tipo.Key || tipo.Descricao || "";
                      const label = tipo.Descricao || tipo.Key || "";
                      return (
                        <label
                          key={key}
                          className="flex items-center gap-2 rounded px-2 py-1 hover:bg-accent cursor-pointer text-sm"
                        >
                          <Checkbox
                            checked={triggerCategories.includes(key)}
                            onCheckedChange={() => toggleCategory(key)}
                          />
                          <span>{label}</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              {triggerCategories.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {triggerCategories.map((cat) => (
                    <Badge
                      key={cat}
                      variant="secondary"
                      className="text-xs cursor-pointer"
                      onClick={() => toggleCategory(cat)}
                    >
                      {cat} ×
                    </Badge>
                  ))}
                </div>
              )}
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
