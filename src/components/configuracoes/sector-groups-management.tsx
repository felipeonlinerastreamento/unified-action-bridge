import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, FolderTree, Loader2, ChevronDown, ChevronRight, Building2, ShieldCheck } from "lucide-react";
import { MENU_CATALOG } from "@/lib/menu-catalog";

interface SectorGroup {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  allowed_menus: string[] | null;
  can_finalize_without_message: boolean;
}

interface Sector {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  group_id: string | null;
}

export function SectorGroupsManagement() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editing, setEditing] = useState<SectorGroup | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [restrictMenus, setRestrictMenus] = useState(false);
  const [allowedMenus, setAllowedMenus] = useState<string[]>([]);
  const [canFinalizeWithoutMessage, setCanFinalizeWithoutMessage] = useState(false);

  // Sector dialog state
  const [sectorDialogOpen, setSectorDialogOpen] = useState(false);
  const [editingSector, setEditingSector] = useState<Sector | null>(null);
  const [sectorName, setSectorName] = useState("");
  const [sectorDescription, setSectorDescription] = useState("");
  const [sectorGroupId, setSectorGroupId] = useState<string>("none");
  const [sectorIsActive, setSectorIsActive] = useState(true);
  const [deleteSectorId, setDeleteSectorId] = useState<string | null>(null);

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const { data: groups = [], isLoading } = useQuery({
    queryKey: ["sector-groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sector_groups").select("*").order("name");
      if (error) throw error;
      return data as SectorGroup[];
    },
  });

  const { data: sectors = [] } = useQuery({
    queryKey: ["local-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").order("name");
      if (error) throw error;
      return data as Sector[];
    },
  });

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Group CRUD
  const resetForm = () => { setName(""); setDescription(""); setIsActive(true); setEditing(null); };
  const openCreate = () => { resetForm(); setDialogOpen(true); };
  const openEdit = (g: SectorGroup) => {
    setEditing(g); setName(g.name); setDescription(g.description || ""); setIsActive(g.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!name.trim()) throw new Error("Nome é obrigatório");
      const payload = { name: name.trim(), description: description.trim(), is_active: isActive };
      if (editing) {
        const { error } = await supabase.from("sector_groups").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sector_groups").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Grupo atualizado" : "Grupo criado");
      queryClient.invalidateQueries({ queryKey: ["sector-groups"] });
      setDialogOpen(false); resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sector_groups").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Grupo excluído");
      queryClient.invalidateQueries({ queryKey: ["sector-groups"] });
      queryClient.invalidateQueries({ queryKey: ["local-sectors"] });
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const toggleGroupMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("sector_groups").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sector-groups"] }),
  });

  // Sector CRUD
  const resetSectorForm = () => { setSectorName(""); setSectorDescription(""); setSectorGroupId("none"); setSectorIsActive(true); setEditingSector(null); };
  
  const openCreateSector = (groupId: string) => {
    resetSectorForm();
    setSectorGroupId(groupId || "none");
    setSectorDialogOpen(true);
  };

  const openEditSector = (s: Sector) => {
    setEditingSector(s);
    setSectorName(s.name);
    setSectorDescription(s.description || "");
    setSectorGroupId(s.group_id || "none");
    setSectorIsActive(s.is_active);
    setSectorDialogOpen(true);
  };

  const saveSectorMutation = useMutation({
    mutationFn: async () => {
      if (!sectorName.trim()) throw new Error("Nome é obrigatório");
      const payload = {
        name: sectorName.trim(),
        description: sectorDescription.trim(),
        group_id: sectorGroupId && sectorGroupId !== "none" ? sectorGroupId : null,
        is_active: sectorIsActive,
      };
      if (editingSector) {
        const { error } = await supabase.from("sectors").update(payload).eq("id", editingSector.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("sectors").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingSector ? "Setor atualizado" : "Setor criado");
      queryClient.invalidateQueries({ queryKey: ["local-sectors"] });
      queryClient.invalidateQueries({ queryKey: ["local-sectors-active"] });
      setSectorDialogOpen(false); resetSectorForm();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteSectorMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sectors").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Setor excluído");
      queryClient.invalidateQueries({ queryKey: ["local-sectors"] });
      queryClient.invalidateQueries({ queryKey: ["local-sectors-active"] });
      setDeleteSectorId(null);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const toggleSectorMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("sectors").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["local-sectors"] });
      queryClient.invalidateQueries({ queryKey: ["local-sectors-active"] });
    },
  });

  const ungroupedSectors = sectors.filter((s) => !s.group_id);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <FolderTree className="h-5 w-5" />
                Grupos de Setores
              </CardTitle>
              <CardDescription>
                Gerencie grupos e seus setores. Clique no grupo para expandir e ver/criar setores.
              </CardDescription>
            </div>
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" /> Novo Grupo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : groups.length === 0 && ungroupedSectors.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              Nenhum grupo cadastrado. Clique em "Novo Grupo" para começar.
            </div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => {
                const groupSectors = sectors.filter((s) => s.group_id === g.id);
                const isExpanded = expandedGroups.has(g.id);
                return (
                  <Collapsible key={g.id} open={isExpanded} onOpenChange={() => toggleGroup(g.id)}>
                    <div className="rounded-lg border border-border">
                      <div className="flex items-center justify-between p-3 bg-muted/30">
                        <CollapsibleTrigger asChild>
                          <button className="flex items-center gap-2 text-left flex-1 min-w-0">
                            {isExpanded ? <ChevronDown className="h-4 w-4 shrink-0" /> : <ChevronRight className="h-4 w-4 shrink-0" />}
                            <span className="font-medium truncate">{g.name}</span>
                            <Badge variant="secondary" className="text-xs shrink-0">{groupSectors.length} setor{groupSectors.length !== 1 ? "es" : ""}</Badge>
                            {!g.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                          </button>
                        </CollapsibleTrigger>
                        <div className="flex items-center gap-1 shrink-0 ml-2">
                          <Switch
                            checked={g.is_active}
                            onCheckedChange={(checked) => toggleGroupMutation.mutate({ id: g.id, active: checked })}
                          />
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); openEdit(g); }}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={(e) => { e.stopPropagation(); setDeleteId(g.id); }}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                      <CollapsibleContent>
                        <div className="p-3 pt-1 space-y-2 border-t border-border">
                          {groupSectors.length === 0 ? (
                            <p className="text-sm text-muted-foreground py-2">Nenhum setor neste grupo.</p>
                          ) : (
                            groupSectors.map((s) => (
                              <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2.5 bg-card">
                                <div className="flex items-center gap-2 min-w-0">
                                  <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                                  <span className="text-sm font-medium truncate">{s.name}</span>
                                  {s.description && <span className="text-xs text-muted-foreground truncate hidden sm:inline">— {s.description}</span>}
                                  {!s.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                                </div>
                                <div className="flex items-center gap-1 shrink-0 ml-2">
                                  <Switch
                                    checked={s.is_active}
                                    onCheckedChange={(checked) => toggleSectorMutation.mutate({ id: s.id, active: checked })}
                                  />
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSector(s)}>
                                    <Pencil className="h-3 w-3" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteSectorId(s.id)}>
                                    <Trash2 className="h-3 w-3 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            ))
                          )}
                          <Button variant="outline" size="sm" className="w-full" onClick={() => openCreateSector(g.id)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Setor
                          </Button>
                        </div>
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                );
              })}

              {ungroupedSectors.length > 0 && (
                <div className="rounded-lg border border-dashed border-border p-3 space-y-2">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Setores sem grupo</p>
                  {ungroupedSectors.map((s) => (
                    <div key={s.id} className="flex items-center justify-between rounded-md border border-border p-2.5 bg-card">
                      <div className="flex items-center gap-2 min-w-0">
                        <Building2 className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                        <span className="text-sm font-medium truncate">{s.name}</span>
                        {!s.is_active && <Badge variant="outline" className="text-xs text-muted-foreground">Inativo</Badge>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0 ml-2">
                        <Switch
                          checked={s.is_active}
                          onCheckedChange={(checked) => toggleSectorMutation.mutate({ id: s.id, active: checked })}
                        />
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditSector(s)}>
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeleteSectorId(s.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Group Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Grupo" : "Novo Grupo de Setores"}</DialogTitle>
            <DialogDescription>Preencha as informações do grupo.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Grupo</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Administrativo" />
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descrição do grupo..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={isActive} onCheckedChange={setIsActive} />
              <Label>Grupo ativo</Label>
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

      {/* Sector Dialog */}
      <Dialog open={sectorDialogOpen} onOpenChange={(open) => { if (!open) { setSectorDialogOpen(false); resetSectorForm(); } else setSectorDialogOpen(true); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingSector ? "Editar Setor" : "Novo Setor"}</DialogTitle>
            <DialogDescription>Preencha as informações do setor.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Setor</Label>
              <Input value={sectorName} onChange={(e) => setSectorName(e.target.value)} placeholder="Ex: Financeiro" />
            </div>
            <div className="space-y-2">
              <Label>Grupo</Label>
              <Select value={sectorGroupId} onValueChange={setSectorGroupId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione um grupo..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem grupo</SelectItem>
                  {groups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Descrição (opcional)</Label>
              <Textarea value={sectorDescription} onChange={(e) => setSectorDescription(e.target.value)} placeholder="Descrição do setor..." />
            </div>
            <div className="flex items-center gap-3">
              <Switch checked={sectorIsActive} onCheckedChange={setSectorIsActive} />
              <Label>Setor ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setSectorDialogOpen(false); resetSectorForm(); }}>Cancelar</Button>
            <Button onClick={() => saveSectorMutation.mutate()} disabled={!sectorName.trim() || saveSectorMutation.isPending}>
              {saveSectorMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              {editingSector ? "Salvar" : "Criar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Group Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir grupo?</AlertDialogTitle>
            <AlertDialogDescription>Os setores deste grupo ficarão sem grupo. Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Sector Dialog */}
      <AlertDialog open={!!deleteSectorId} onOpenChange={(open) => !open && setDeleteSectorId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir setor?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteSectorId && deleteSectorMutation.mutate(deleteSectorId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
