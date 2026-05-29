import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { getTiposPendencia } from "@/lib/gsystem-api.functions";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Plus, Pencil, Trash2, ListTree, Loader2, Package } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  useLiberacaoCatalog,
  useSubcategoryEquipmentModelLinks,
  useAllSubcategoryModelCounts,
  syncSubcategoryEquipmentModels,
} from "@/hooks/use-liberacao-equipamento";

type Subcategory = {
  id: string;
  category_key: string;
  category_label: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
};

export function TicketSubcategoriesConfig() {
  const { hasRole, isAuthenticated } = useAuth();
  const isAdmin = hasRole("admin");
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subcategory | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [filterCategoryKey, setFilterCategoryKey] = useState<string>("all");

  // Form
  const [categoryKey, setCategoryKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>([]);

  const { data: equipmentCatalog = [] } = useLiberacaoCatalog(isAuthenticated && dialogOpen);
  const { data: existingLinks = [] } = useSubcategoryEquipmentModelLinks(editing?.id);
  const { data: modelCounts = {} } = useAllSubcategoryModelCounts();

  // Hydrate selection when opening edit dialog (after links load)
  useEffect(() => {
    if (editing && dialogOpen) {
      setSelectedModelIds(existingLinks);
    }
  }, [editing, dialogOpen, existingLinks]);

  const toggleModelId = (id: string) => {
    setSelectedModelIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  };

  const { data: tiposPendencia = [] } = useQuery({
    queryKey: ["tipos-pendencia-subcategories"],
    queryFn: async () => {
      const result: any = await getTiposPendencia(await getAuthHeaders());
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60_000,
  });

  const categoryByKey = useMemo(() => {
    const map = new Map<string, string>();
    for (const t of tiposPendencia as any[]) {
      if (t?.Key) map.set(String(t.Key), String(t.Descricao || t.Key));
    }
    return map;
  }, [tiposPendencia]);

  const { data: subcategories = [], isLoading } = useQuery({
    queryKey: ["ticket-subcategories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ticket_subcategories")
        .select("*")
        .order("category_label", { ascending: true })
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []) as Subcategory[];
    },
    enabled: isAuthenticated,
  });

  const filtered = useMemo(() => {
    if (filterCategoryKey === "all") return subcategories;
    return subcategories.filter((s) => s.category_key === filterCategoryKey);
  }, [subcategories, filterCategoryKey]);

  const resetForm = () => {
    setEditing(null);
    setCategoryKey("");
    setName("");
    setDescription("");
    setIsActive(true);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (s: Subcategory) => {
    setEditing(s);
    setCategoryKey(s.category_key);
    setName(s.name);
    setDescription(s.description || "");
    setIsActive(s.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!categoryKey) throw new Error("Selecione a categoria");
      if (!name.trim()) throw new Error("Informe o nome do sub-item");
      const label = categoryByKey.get(categoryKey) || categoryKey;
      const payload = {
        category_key: categoryKey,
        category_label: label,
        name: name.trim(),
        description: description.trim() || null,
        is_active: isActive,
      };
      if (editing) {
        const { error } = await supabase
          .from("ticket_subcategories")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("ticket_subcategories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Sub-item atualizado" : "Sub-item criado");
      queryClient.invalidateQueries({ queryKey: ["ticket-subcategories"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ticket_subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Sub-item removido");
      queryClient.invalidateQueries({ queryKey: ["ticket-subcategories"] });
      setDeleteId(null);
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("ticket_subcategories")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ticket-subcategories"] });
    },
  });

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2">
              <ListTree className="h-5 w-5" />
              Sub-Menu de Categorias
            </CardTitle>
            <CardDescription>
              Para cada categoria sincronizada com o GSystem, cadastre sub-itens
              (ex.: categoria "Pane Rastreador" → sub-item "Buzzer disparado").
              Os sub-itens ficam disponíveis ao selecionar a categoria no atendimento.
            </CardDescription>
          </div>
          {isAdmin && (
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Novo sub-item
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-2">
          <Label className="text-xs">Filtrar por categoria</Label>
          <Select value={filterCategoryKey} onValueChange={setFilterCategoryKey}>
            <SelectTrigger className="w-[280px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {(tiposPendencia as any[]).map((t) => (
                <SelectItem key={String(t.Key)} value={String(t.Key)}>
                  {t.Descricao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            Nenhum sub-item cadastrado{filterCategoryKey !== "all" ? " para esta categoria" : ""}.
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead>Sub-item</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Ativo</TableHead>
                {isAdmin && <TableHead className="w-[100px]">Ações</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((s) => (
                <TableRow key={s.id}>
                  <TableCell>
                    <Badge variant="outline">{s.category_label || s.category_key}</Badge>
                  </TableCell>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {s.description || "—"}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={s.is_active}
                      disabled={!isAdmin}
                      onCheckedChange={(checked) =>
                        toggleMutation.mutate({ id: s.id, active: checked })
                      }
                    />
                  </TableCell>
                  {isAdmin && (
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
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setDialogOpen(false);
            resetForm();
          } else setDialogOpen(true);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar sub-item" : "Novo sub-item"}</DialogTitle>
            <DialogDescription>
              Vincule o sub-item a uma categoria já existente no GSystem.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label>Categoria</Label>
              <Select value={categoryKey} onValueChange={setCategoryKey}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {(tiposPendencia as any[]).map((t) => (
                    <SelectItem key={String(t.Key)} value={String(t.Key)}>
                      {t.Descricao}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Nome do sub-item</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex.: Buzzer disparado"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Descrição (opcional)</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
              />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
              Cancelar
            </Button>
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!categoryKey || !name.trim() || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editing ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir sub-item?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação é permanente. Atendimentos que já usaram esse sub-item
              manterão o nome registrado no histórico.
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
