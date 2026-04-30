import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertKeyResult } from "@/lib/okr.functions";
import { toast } from "sonner";

export function KeyResultFormDialog({
  open, onOpenChange, objectiveId, keyResult,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  objectiveId: string;
  keyResult?: any;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(keyResult?.title ?? "");
  const [unit, setUnit] = useState(keyResult?.unit ?? "");
  const [direction, setDirection] = useState<"increase" | "decrease">(keyResult?.direction ?? "increase");
  const [initialValue, setInitialValue] = useState<string>(String(keyResult?.initial_value ?? "0"));
  const [targetValue, setTargetValue] = useState<string>(String(keyResult?.target_value ?? ""));
  const [currentValue, setCurrentValue] = useState<string>(String(keyResult?.current_value ?? "0"));

  const save = useMutation({
    mutationFn: () => upsertKeyResult({
      data: {
        id: keyResult?.id,
        objective_id: objectiveId,
        title,
        kr_type: "manual",
        unit,
        direction,
        initial_value: Number(initialValue) || 0,
        target_value: Number(targetValue) || 0,
        current_value: Number(currentValue) || 0,
        metric_filter: {},
        display_order: 0,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["okr-objectives"] });
      toast.success(keyResult ? "KR atualizado" : "KR criado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{keyResult ? "Editar Key Result" : "Novo Key Result"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Reduzir TMA para 12 minutos" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Unidade</Label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="min, %, un" />
            </div>
            <div>
              <Label>Direção *</Label>
              <Select value={direction} onValueChange={(v) => setDirection(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="increase">Aumentar é melhor</SelectItem>
                  <SelectItem value="decrease">Diminuir é melhor</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label>Valor inicial</Label>
              <Input type="number" value={initialValue} onChange={(e) => setInitialValue(e.target.value)} />
            </div>
            <div>
              <Label>Valor atual</Label>
              <Input type="number" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} />
            </div>
            <div>
              <Label>Meta *</Label>
              <Input type="number" value={targetValue} onChange={(e) => setTargetValue(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!title || !targetValue || save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
