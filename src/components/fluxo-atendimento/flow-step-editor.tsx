import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus, Pencil, Trash2, Loader2, ArrowDown, ArrowUp,
  CheckCircle2, SkipForward, RotateCcw, Clock, Zap, UserCheck, Shield,
} from "lucide-react";

type Step = {
  id: string;
  flow_id: string;
  step_name: string;
  step_order: number;
  sector_name: string;
  is_required: boolean;
  allow_return: boolean;
  allow_skip: boolean;
  requires_assignment: boolean;
  expected_time_minutes: number | null;
  auto_advance: boolean;
};

type StepRule = {
  id: string;
  step_id: string;
  required_fields: string[];
  allowed_roles: string[];
  can_finalize: boolean;
  finalization_requires_decision: boolean;
  decision_options: string[];
};

type Props = {
  flowId: string;
  flowName: string;
};

export function FlowStepEditor({ flowId, flowName }: Props) {
  const queryClient = useQueryClient();
  const [stepDialogOpen, setStepDialogOpen] = useState(false);
  const [ruleDialogOpen, setRuleDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<Step | null>(null);
  const [editingRuleStepId, setEditingRuleStepId] = useState<string | null>(null);

  // Step form
  const [stepName, setStepName] = useState("");
  const [sectorName, setSectorName] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [allowReturn, setAllowReturn] = useState(false);
  const [allowSkip, setAllowSkip] = useState(false);
  const [requiresAssignment, setRequiresAssignment] = useState(false);
  const [expectedTime, setExpectedTime] = useState<string>("");
  const [autoAdvance, setAutoAdvance] = useState(false);

  // Rule form
  const [requiredFields, setRequiredFields] = useState("");
  const [allowedRoles, setAllowedRoles] = useState("");
  const [canFinalize, setCanFinalize] = useState(false);
  const [finalizationRequiresDecision, setFinalizationRequiresDecision] = useState(false);
  const [decisionOptions, setDecisionOptions] = useState("");

  const { data: steps = [], isLoading } = useQuery({
    queryKey: ["flow-steps", flowId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_flow_steps")
        .select("*")
        .eq("flow_id", flowId)
        .order("step_order");
      if (error) throw error;
      return data as Step[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["flow-step-rules", flowId],
    queryFn: async () => {
      const stepIds = steps.map((s) => s.id);
      if (stepIds.length === 0) return [];
      const { data, error } = await supabase
        .from("service_flow_step_rules")
        .select("*")
        .in("step_id", stepIds);
      if (error) throw error;
      return data as StepRule[];
    },
    enabled: steps.length > 0,
  });

  const getRuleForStep = (stepId: string) => rules.find((r) => r.step_id === stepId);

  const saveStepMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        flow_id: flowId,
        step_name: stepName,
        sector_name: sectorName,
        is_required: isRequired,
        allow_return: allowReturn,
        allow_skip: allowSkip,
        requires_assignment: requiresAssignment,
        expected_time_minutes: expectedTime ? parseInt(expectedTime) : null,
        auto_advance: autoAdvance,
      };
      if (editingStep) {
        const { error } = await supabase
          .from("service_flow_steps")
          .update(payload)
          .eq("id", editingStep.id);
        if (error) throw error;
      } else {
        const nextOrder = steps.length > 0 ? Math.max(...steps.map((s) => s.step_order)) + 1 : 1;
        const { error } = await supabase
          .from("service_flow_steps")
          .insert({ ...payload, step_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editingStep ? "Etapa atualizada" : "Etapa criada");
      queryClient.invalidateQueries({ queryKey: ["flow-steps", flowId] });
      setStepDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteStepMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_flow_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Etapa removida");
      queryClient.invalidateQueries({ queryKey: ["flow-steps", flowId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const reorderMutation = useMutation({
    mutationFn: async ({ stepId, newOrder }: { stepId: string; newOrder: number }) => {
      const { error } = await supabase
        .from("service_flow_steps")
        .update({ step_order: newOrder })
        .eq("id", stepId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["flow-steps", flowId] });
    },
  });

  const saveRuleMutation = useMutation({
    mutationFn: async () => {
      if (!editingRuleStepId) return;
      const payload = {
        step_id: editingRuleStepId,
        required_fields: requiredFields.split(",").map((s) => s.trim()).filter(Boolean),
        allowed_roles: allowedRoles.split(",").map((s) => s.trim()).filter(Boolean),
        can_finalize: canFinalize,
        finalization_requires_decision: finalizationRequiresDecision,
        decision_options: decisionOptions.split(",").map((s) => s.trim()).filter(Boolean),
      };
      const existing = getRuleForStep(editingRuleStepId);
      if (existing) {
        const { error } = await supabase
          .from("service_flow_step_rules")
          .update(payload)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("service_flow_step_rules").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Regras salvas");
      queryClient.invalidateQueries({ queryKey: ["flow-step-rules", flowId] });
      setRuleDialogOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openCreateStep = () => {
    setEditingStep(null);
    setStepName("");
    setSectorName("");
    setIsRequired(true);
    setAllowReturn(false);
    setAllowSkip(false);
    setRequiresAssignment(false);
    setExpectedTime("");
    setAutoAdvance(false);
    setStepDialogOpen(true);
  };

  const openEditStep = (step: Step) => {
    setEditingStep(step);
    setStepName(step.step_name);
    setSectorName(step.sector_name);
    setIsRequired(step.is_required);
    setAllowReturn(step.allow_return);
    setAllowSkip(step.allow_skip);
    setRequiresAssignment(step.requires_assignment);
    setExpectedTime(step.expected_time_minutes?.toString() || "");
    setAutoAdvance(step.auto_advance);
    setStepDialogOpen(true);
  };

  const openRuleEditor = (stepId: string) => {
    setEditingRuleStepId(stepId);
    const existing = getRuleForStep(stepId);
    setRequiredFields(existing?.required_fields?.join(", ") || "");
    setAllowedRoles(existing?.allowed_roles?.join(", ") || "");
    setCanFinalize(existing?.can_finalize || false);
    setFinalizationRequiresDecision(existing?.finalization_requires_decision || false);
    setDecisionOptions(existing?.decision_options?.join(", ") || "");
    setRuleDialogOpen(true);
  };

  const moveStep = (stepId: string, direction: "up" | "down") => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= steps.length) return;
    const currentOrder = steps[idx].step_order;
    const swapOrder = steps[swapIdx].step_order;
    reorderMutation.mutate({ stepId: steps[idx].id, newOrder: swapOrder });
    reorderMutation.mutate({ stepId: steps[swapIdx].id, newOrder: currentOrder });
  };

  const stepColors = [
    "border-l-blue-500", "border-l-emerald-500", "border-l-amber-500",
    "border-l-purple-500", "border-l-rose-500", "border-l-cyan-500",
    "border-l-indigo-500", "border-l-teal-500",
  ];

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <CardTitle className="text-base">Etapas do Fluxo</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">{flowName}</p>
          </div>
          <Button size="sm" onClick={openCreateStep}>
            <Plus className="h-3.5 w-3.5 mr-1" /> Nova Etapa
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : steps.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              Nenhuma etapa cadastrada. Adicione etapas para montar a jornada.
            </p>
          ) : (
            <>
              {/* Pipeline Preview */}
              <div className="flex items-center gap-1 mb-4 overflow-x-auto pb-2">
                {steps.map((step, i) => (
                  <div key={step.id} className="flex items-center">
                    <div className={`px-3 py-1.5 rounded-md text-xs font-medium border ${stepColors[i % stepColors.length]} border-l-4 bg-card`}>
                      <span className="text-muted-foreground mr-1">{step.step_order}.</span>
                      {step.step_name}
                      <span className="text-muted-foreground ml-1 text-[10px]">({step.sector_name})</span>
                    </div>
                    {i < steps.length - 1 && (
                      <ArrowDown className="h-3.5 w-3.5 text-muted-foreground mx-1 rotate-[-90deg]" />
                    )}
                  </div>
                ))}
              </div>

              <Separator className="mb-4" />

              <div className="space-y-2">
                {steps.map((step, i) => {
                  const rule = getRuleForStep(step.id);
                  return (
                    <div
                      key={step.id}
                      className={`rounded-lg border ${stepColors[i % stepColors.length]} border-l-4 p-3`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">{step.step_order}. {step.step_name}</span>
                            <Badge variant="outline" className="text-[10px]">{step.sector_name}</Badge>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            {step.is_required && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5">
                                <CheckCircle2 className="h-2.5 w-2.5" /> Obrigatória
                              </Badge>
                            )}
                            {step.auto_advance && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5">
                                <Zap className="h-2.5 w-2.5" /> Auto-avanço
                              </Badge>
                            )}
                            {step.allow_skip && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5">
                                <SkipForward className="h-2.5 w-2.5" /> Pode pular
                              </Badge>
                            )}
                            {step.allow_return && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5">
                                <RotateCcw className="h-2.5 w-2.5" /> Permite retorno
                              </Badge>
                            )}
                            {step.requires_assignment && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5">
                                <UserCheck className="h-2.5 w-2.5" /> Responsável obrigatório
                              </Badge>
                            )}
                            {step.expected_time_minutes && (
                              <Badge variant="secondary" className="text-[10px] gap-0.5">
                                <Clock className="h-2.5 w-2.5" /> {step.expected_time_minutes}min
                              </Badge>
                            )}
                            {rule?.can_finalize && (
                              <Badge variant="default" className="text-[10px] gap-0.5">
                                <Shield className="h-2.5 w-2.5" /> Pode finalizar
                              </Badge>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button size="sm" variant="ghost" onClick={() => moveStep(step.id, "up")} disabled={i === 0}>
                            <ArrowUp className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => moveStep(step.id, "down")} disabled={i === steps.length - 1}>
                            <ArrowDown className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openRuleEditor(step.id)}>
                            <Shield className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => openEditStep(step)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => deleteStepMutation.mutate(step.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Step Dialog */}
      <Dialog open={stepDialogOpen} onOpenChange={setStepDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingStep ? "Editar Etapa" : "Nova Etapa"}</DialogTitle>
            <DialogDescription>Configure os detalhes e comportamento da etapa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2 max-h-[60vh] overflow-y-auto">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Nome da Etapa</Label>
                <Input value={stepName} onChange={(e) => setStepName(e.target.value)} placeholder="Ex: Agendamento" />
              </div>
              <div>
                <Label>Setor Responsável</Label>
                <Input value={sectorName} onChange={(e) => setSectorName(e.target.value)} placeholder="Ex: Financeiro" />
              </div>
            </div>
            <div>
              <Label>Tempo Esperado (minutos)</Label>
              <Input type="number" value={expectedTime} onChange={(e) => setExpectedTime(e.target.value)} placeholder="Ex: 60" />
            </div>
            <Separator />
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2">
                <Switch checked={isRequired} onCheckedChange={setIsRequired} />
                <Label className="text-sm">Etapa obrigatória</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={autoAdvance} onCheckedChange={setAutoAdvance} />
                <Label className="text-sm">Avanço automático</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowReturn} onCheckedChange={setAllowReturn} />
                <Label className="text-sm">Permite retorno</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={allowSkip} onCheckedChange={setAllowSkip} />
                <Label className="text-sm">Permite pular</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={requiresAssignment} onCheckedChange={setRequiresAssignment} />
                <Label className="text-sm">Responsável obrigatório</Label>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setStepDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveStepMutation.mutate()} disabled={!stepName.trim() || !sectorName.trim() || saveStepMutation.isPending}>
                {saveStepMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                {editingStep ? "Salvar" : "Criar"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rule Dialog */}
      <Dialog open={ruleDialogOpen} onOpenChange={setRuleDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Regras da Etapa</DialogTitle>
            <DialogDescription>Configure permissões, campos obrigatórios e regras de finalização.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div>
              <Label>Campos Obrigatórios</Label>
              <Input value={requiredFields} onChange={(e) => setRequiredFields(e.target.value)} placeholder="Ex: placa, observação (separados por vírgula)" />
              <p className="text-xs text-muted-foreground mt-1">Separe por vírgula</p>
            </div>
            <div>
              <Label>Perfis Autorizados</Label>
              <Input value={allowedRoles} onChange={(e) => setAllowedRoles(e.target.value)} placeholder="Ex: admin, gestor, atendente" />
              <p className="text-xs text-muted-foreground mt-1">Separe por vírgula. Vazio = todos</p>
            </div>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Switch checked={canFinalize} onCheckedChange={setCanFinalize} />
                <Label className="text-sm">Esta etapa pode finalizar o atendimento</Label>
              </div>
              {canFinalize && (
                <>
                  <div className="flex items-center gap-2">
                    <Switch checked={finalizationRequiresDecision} onCheckedChange={setFinalizationRequiresDecision} />
                    <Label className="text-sm">Exige decisão antes de finalizar</Label>
                  </div>
                  {finalizationRequiresDecision && (
                    <div>
                      <Label>Opções de Decisão</Label>
                      <Input value={decisionOptions} onChange={(e) => setDecisionOptions(e.target.value)} placeholder="Ex: Cobra cliente, Não cobra cliente" />
                      <p className="text-xs text-muted-foreground mt-1">Separe por vírgula</p>
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setRuleDialogOpen(false)}>Cancelar</Button>
              <Button onClick={() => saveRuleMutation.mutate()} disabled={saveRuleMutation.isPending}>
                {saveRuleMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
                Salvar Regras
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
