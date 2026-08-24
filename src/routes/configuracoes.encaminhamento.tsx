import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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
import { supabase } from "@/integrations/supabase/client";
import { getTiposPendencia } from "@/lib/gsystem-api.functions";
import { listSectors } from "@/lib/gsystem.functions";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ArrowRightLeft, Loader2 } from "lucide-react";
import { SectorsManagement } from "@/components/configuracoes/sectors-management";
import { TrackingSedexConfig } from "@/components/configuracoes/tracking-sedex-config";
import { TesteEquipamentoConfig } from "@/components/configuracoes/teste-equipamento-config";
import { LiberacaoEquipamentoConfig } from "@/components/configuracoes/liberacao-equipamento-config";
import { PurchaseConfig } from "@/components/configuracoes/purchase-config";
import { PerdidosConfig } from "@/components/configuracoes/perdidos-config";
import { EscalonamentoGestaoConfig } from "@/components/configuracoes/escalonamento-gestao-config";
import { ChatIdleAutoMessagesConfig } from "@/components/configuracoes/chat-idle-auto-messages-config";
import { TicketActivitiesConfig } from "@/components/configuracoes/ticket-activities-config";
import { TicketSubcategoriesConfig } from "@/components/configuracoes/ticket-subcategories-config";
import { ChatTagCatalogConfig } from "@/components/configuracoes/chat-tag-catalog-config";
import { OfflineRoutingConfig } from "@/components/configuracoes/offline-routing-config";
import { PlatformsConfig } from "@/components/configuracoes/platforms-config";

export const Route = createFileRoute("/configuracoes/encaminhamento")({
  component: EncaminhamentoPage,
});

interface RoutingRule {
  id: string;
  category_key: string;
  category_label: string;
  target_sector_name: string;
  target_sector_id: string;
  auto_create_ticket: boolean;
  is_active: boolean;
}

function EncaminhamentoPage() {
  const { isAuthenticated, session } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingRule, setEditingRule] = useState<RoutingRule | null>(null);

  // Form state
  const [categoryKey, setCategoryKey] = useState("");
  const [categoryLabel, setCategoryLabel] = useState("");
  const [targetSectorId, setTargetSectorId] = useState("");
  const [targetSectorName, setTargetSectorName] = useState("");
  const [autoCreateTicket, setAutoCreateTicket] = useState(true);
  const [isActive, setIsActive] = useState(true);

  const getAuthHeaders = async () => {
    const { data: { session: s } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${s?.access_token}` } };
  };

  // Get channel for GSystem calls
  const { data: channels = [] } = useQuery({
    queryKey: ["channels"],
    queryFn: async () => {
      const { data } = await supabase.from("channels").select("id, name").eq("is_active", true);
      return data || [];
    },
    enabled: isAuthenticated,
  });

  const channelId = channels[0]?.id || "";

  // Fetch routing rules
  const { data: rules = [], isLoading: rulesLoading } = useQuery({
    queryKey: ["category-routing-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("category_routing_rules")
        .select("*")
        .order("category_label");
      if (error) throw error;
      return (data || []) as RoutingRule[];
    },
    enabled: isAuthenticated,
  });

  // Fetch categories from GSystem
  const { data: tiposPendencia = [] } = useQuery({
    queryKey: ["tipos-pendencia-config"],
    queryFn: async () => {
      const auth = await getAuthHeaders();
      return getTiposPendencia(auth);
    },
    enabled: isAuthenticated,
  });

  // Fetch sectors from GSystem
  const { data: gsystemSectors = [] } = useQuery({
    queryKey: ["sectors-config", channelId],
    queryFn: async () => {
      if (!channelId) return [];
      const auth = await getAuthHeaders();
      const result: any = await listSectors({ data: { channelId }, ...auth });
      return Array.isArray(result) ? result : result?.data || [];
    },
    enabled: isAuthenticated && !!channelId,
  });

  // Fetch local sectors
  const { data: localSectors = [] } = useQuery({
    queryKey: ["local-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("*").eq("is_active", true).order("name");
      if (error) throw error;
      return data || [];
    },
    enabled: isAuthenticated,
  });

  // Merge GSystem + local sectors
  const allSectors = [
    ...gsystemSectors.map((s: any) => ({ id: s.id || s.Id, name: s.description || s.name || s.Description, source: "gsystem" })),
    ...localSectors.map((s: any) => ({ id: s.id, name: s.name, source: "local" })),
  ];

  const resetForm = () => {
    setCategoryKey("");
    setCategoryLabel("");
    setTargetSectorId("");
    setTargetSectorName("");
    setAutoCreateTicket(true);
    setIsActive(true);
    setEditingRule(null);
  };

  const openCreate = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEdit = (rule: RoutingRule) => {
    setEditingRule(rule);
    setCategoryKey(rule.category_key);
    setCategoryLabel(rule.category_label);
    setTargetSectorId(rule.target_sector_id);
    setTargetSectorName(rule.target_sector_name);
    setAutoCreateTicket(rule.auto_create_ticket);
    setIsActive(rule.is_active);
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!categoryKey || !targetSectorId) throw new Error("Preencha categoria e setor");
      const payload = {
        category_key: categoryKey,
        category_label: categoryLabel,
        target_sector_id: targetSectorId,
        target_sector_name: targetSectorName,
        auto_create_ticket: autoCreateTicket,
        is_active: isActive,
      };
      if (editingRule) {
        const { error } = await supabase
          .from("category_routing_rules")
          .update(payload)
          .eq("id", editingRule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("category_routing_rules")
          .insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingRule ? "Regra atualizada" : "Regra criada");
      queryClient.invalidateQueries({ queryKey: ["category-routing-rules"] });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao salvar"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("category_routing_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Regra excluída");
      queryClient.invalidateQueries({ queryKey: ["category-routing-rules"] });
      setDeleteId(null);
    },
    onError: (err: any) => toast.error(err?.message || "Erro ao excluir"),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("category_routing_rules")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["category-routing-rules"] });
    },
  });

  const handleCategoryChange = (key: string) => {
    setCategoryKey(key);
    const found = tiposPendencia.find((t: any) => t.Key === key);
    setCategoryLabel(found?.Descricao || key);
  };

  const handleSectorChange = (sectorId: string) => {
    setTargetSectorId(sectorId);
    const found = allSectors.find((s) => s.id === sectorId);
    setTargetSectorName(found?.name || sectorId);
  };

  return (
    <AppLayout>
      <div className="p-6 space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ArrowRightLeft className="h-6 w-6" />
              Encaminhamento por Categoria
            </h1>
            <p className="text-muted-foreground mt-1">
              Configure para quais setores os atendimentos são encaminhados automaticamente ao finalizar
            </p>
          </div>
          <Button onClick={openCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Nova Regra
          </Button>
        </div>

        <OfflineRoutingConfig />

        <TrackingSedexConfig />

        <TesteEquipamentoConfig />

        <LiberacaoEquipamentoConfig />

        <PurchaseConfig />

        <PerdidosConfig />

        <EscalonamentoGestaoConfig />

        <ChatIdleAutoMessagesConfig />

        <TicketActivitiesConfig />

        <TicketSubcategoriesConfig />

        <ChatTagCatalogConfig />

        <PlatformsConfig />




        <Card>
          <CardHeader>
            <CardTitle>Regras de Encaminhamento</CardTitle>
            <CardDescription>
              Quando um atendimento for finalizado com uma dessas categorias, um novo atendimento será criado automaticamente no setor configurado.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {rulesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhuma regra configurada. Clique em "Nova Regra" para começar.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Setor Destino</TableHead>
                    <TableHead>Criar Ticket</TableHead>
                    <TableHead>Ativo</TableHead>
                    <TableHead className="w-[100px]">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell>
                        <Badge variant="outline">{rule.category_label || rule.category_key}</Badge>
                      </TableCell>
                      <TableCell>{rule.target_sector_name || rule.target_sector_id}</TableCell>
                      <TableCell>
                        {rule.auto_create_ticket ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">Sim</Badge>
                        ) : (
                          <Badge variant="secondary">Não</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Switch
                          checked={rule.is_active}
                          onCheckedChange={(checked) =>
                            toggleMutation.mutate({ id: rule.id, active: checked })
                          }
                        />
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(rule)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => setDeleteId(rule.id)}>
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

        

        <SectorsManagement />

        {/* Create/Edit Dialog */}
        <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) { setDialogOpen(false); resetForm(); } else setDialogOpen(true); }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Encaminhamento"}</DialogTitle>
              <DialogDescription>
                Defina qual categoria será encaminhada automaticamente para qual setor.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Categoria do Atendimento</Label>
                <Select value={categoryKey} onValueChange={handleCategoryChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione a categoria..." />
                  </SelectTrigger>
                  <SelectContent>
                    {tiposPendencia.map((t: any) => (
                      <SelectItem key={t.Key} value={t.Key}>
                        {t.Descricao}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Setor de Destino</Label>
                <Select value={targetSectorId} onValueChange={handleSectorChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {allSectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.source === "local" ? "(Local)" : "(GSystem)"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={autoCreateTicket} onCheckedChange={setAutoCreateTicket} />
                <Label>Criar ticket automaticamente</Label>
              </div>

              <div className="flex items-center gap-3">
                <Switch checked={isActive} onCheckedChange={setIsActive} />
                <Label>Regra ativa</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => { setDialogOpen(false); resetForm(); }}>
                Cancelar
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!categoryKey || !targetSectorId || saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingRule ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation */}
        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta ação não pode ser desfeita. A regra de encaminhamento será removida permanentemente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              >
                Excluir
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </AppLayout>
  );
}
