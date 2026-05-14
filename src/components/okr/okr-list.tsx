import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Plus, Target, ChevronDown, ChevronRight, Pencil, Trash2, Activity } from "lucide-react";
import {
  listObjectives, listOkrCycles, deleteObjective, deleteKeyResult,
} from "@/lib/okr.functions";
import { computeKrScore, computeObjectiveScore, confidenceColor, confidenceLabel, levelLabel } from "@/lib/okr-utils";
import { ObjectiveFormDialog } from "./objective-form-dialog";
import { KeyResultFormDialog } from "./key-result-form-dialog";
import { CheckinDialog } from "./checkin-dialog";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Objective = Awaited<ReturnType<typeof listObjectives>>[number];
type KR = NonNullable<Objective["okr_key_results"]>[number];

export function OkrList() {
  const qc = useQueryClient();
  const [cycleFilter, setCycleFilter] = useState<string>("all");
  const [levelFilter, setLevelFilter] = useState<string>("all");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [editingObj, setEditingObj] = useState<Objective | null>(null);
  const [creatingObj, setCreatingObj] = useState(false);
  const [krDialog, setKrDialog] = useState<{ objectiveId: string; kr?: KR } | null>(null);
  const [checkinKr, setCheckinKr] = useState<KR | null>(null);

  const cyclesQ = useQuery({ queryKey: ["okr-cycles"], queryFn: () => listOkrCycles() });
  const objsQ = useQuery({
    queryKey: ["okr-objectives", cycleFilter],
    queryFn: () => listObjectives({ data: cycleFilter === "all" ? {} : { cycle_id: cycleFilter } }),
  });

  const delObj = useMutation({
    mutationFn: (id: string) => deleteObjective({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["okr-objectives"] }); toast.success("Objetivo removido"); },
  });
  const delKr = useMutation({
    mutationFn: (id: string) => deleteKeyResult({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["okr-objectives"] }); toast.success("Key Result removido"); },
  });

  const objectives = (objsQ.data ?? []).filter(o => levelFilter === "all" || o.level === levelFilter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Select value={cycleFilter} onValueChange={setCycleFilter}>
          <SelectTrigger className="w-[200px]"><SelectValue placeholder="Ciclo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os ciclos</SelectItem>
            {(cyclesQ.data ?? []).map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={levelFilter} onValueChange={setLevelFilter}>
          <SelectTrigger className="w-[180px]"><SelectValue placeholder="Nível" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os níveis</SelectItem>
            <SelectItem value="empresa">Empresa</SelectItem>
            <SelectItem value="setor">Setor</SelectItem>
            <SelectItem value="individual">Individual</SelectItem>
          </SelectContent>
        </Select>
        <div className="ml-auto">
          <Button onClick={() => setCreatingObj(true)} disabled={!cyclesQ.data?.length}>
            <Plus className="h-4 w-4 mr-1" /> Novo Objetivo
          </Button>
        </div>
      </div>

      {!cyclesQ.data?.length && (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">
          Nenhum ciclo cadastrado. Vá em <strong>Configurações → OKR</strong> para criar o primeiro ciclo.
        </CardContent></Card>
      )}

      {objsQ.isLoading && <p className="text-sm text-muted-foreground">Carregando…</p>}
      {!objsQ.isLoading && !objectives.length && cyclesQ.data?.length ? (
        <Card><CardContent className="py-6 text-sm text-muted-foreground">Nenhum objetivo cadastrado para o filtro selecionado.</CardContent></Card>
      ) : null}

      <div className="grid gap-3">
        {objectives.map((obj) => {
          const krs = (obj.okr_key_results ?? []) as KR[];
          const score = computeObjectiveScore(krs.map(k => ({
            initial_value: Number(k.initial_value),
            current_value: Number(k.current_value),
            target_value: Number(k.target_value),
            direction: k.direction as "increase" | "decrease",
          })));
          const isOpen = expanded[obj.id] ?? true;
          return (
            <Card key={obj.id}>
              <CardHeader className="pb-3">
                <div className="flex items-start gap-3">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [obj.id]: !isOpen }))}
                    className="mt-1 text-muted-foreground hover:text-foreground"
                  >
                    {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </button>
                  <Target className="h-5 w-5 text-primary mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-semibold">{obj.title}</h3>
                      <Badge variant="outline">{levelLabel(obj.level)}</Badge>
                      {obj.status !== "ativo" && <Badge variant="secondary">{obj.status}</Badge>}
                    </div>
                    {obj.description && <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap break-words">{obj.description}</p>}
                    <div className="mt-2 flex items-center gap-3">
                      <Progress value={score * 100} className="h-2 flex-1" />
                      <span className="text-sm font-mono w-12 text-right">{Math.round(score * 100)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button size="sm" variant="ghost" onClick={() => setEditingObj(obj)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este objetivo e todos os KRs?")) delObj.mutate(obj.id); }}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {isOpen && (
                <CardContent className="space-y-2">
                  {krs.map(kr => {
                    const krScore = computeKrScore(
                      Number(kr.initial_value), Number(kr.current_value), Number(kr.target_value),
                      kr.direction as "increase" | "decrease",
                    );
                    return (
                      <div key={kr.id} className="flex items-center gap-3 p-3 rounded-md border bg-muted/20">
                        <div className={`h-2 w-2 rounded-full ${confidenceColor(kr.confidence as any)}`} title={confidenceLabel(kr.confidence as any)} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium truncate">{kr.title}</p>
                            {kr.kr_type === "automatico" && <Badge variant="secondary" className="text-[10px]">auto</Badge>}
                          </div>
                          <div className="flex items-center gap-3 mt-1">
                            <Progress value={krScore * 100} className="h-1.5 flex-1" />
                            <span className="text-xs font-mono text-muted-foreground whitespace-nowrap">
                              {Number(kr.current_value)} / {Number(kr.target_value)} {kr.unit}
                            </span>
                            <span className="text-xs font-mono w-10 text-right">{Math.round(krScore * 100)}%</span>
                          </div>
                        </div>
                        <Button size="sm" variant="ghost" onClick={() => setCheckinKr(kr)} title="Check-in">
                          <Activity className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setKrDialog({ objectiveId: obj.id, kr })}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover este KR?")) delKr.mutate(kr.id); }}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                  <Button size="sm" variant="outline" onClick={() => setKrDialog({ objectiveId: obj.id })}>
                    <Plus className="h-3.5 w-3.5 mr-1" /> Adicionar Key Result
                  </Button>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      {(creatingObj || editingObj) && (
        <ObjectiveFormDialog
          open
          onOpenChange={(o) => { if (!o) { setCreatingObj(false); setEditingObj(null); } }}
          cycles={cyclesQ.data ?? []}
          objective={editingObj}
          defaultCycleId={cycleFilter !== "all" ? cycleFilter : undefined}
        />
      )}
      {krDialog && (
        <KeyResultFormDialog
          open
          onOpenChange={(o) => { if (!o) setKrDialog(null); }}
          objectiveId={krDialog.objectiveId}
          keyResult={krDialog.kr}
        />
      )}
      {checkinKr && (
        <CheckinDialog
          open
          onOpenChange={(o) => { if (!o) setCheckinKr(null); }}
          keyResult={checkinKr}
        />
      )}
    </div>
  );
}
