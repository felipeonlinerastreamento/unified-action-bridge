import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { upsertObjective } from "@/lib/okr.functions";
import { toast } from "sonner";

type Cycle = { id: string; name: string };
type Objective = any;

export function ObjectiveFormDialog({
  open, onOpenChange, cycles, objective, defaultCycleId,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  cycles: Cycle[];
  objective: Objective | null;
  defaultCycleId?: string;
}) {
  const qc = useQueryClient();
  const [title, setTitle] = useState(objective?.title ?? "");
  const [description, setDescription] = useState(objective?.description ?? "");
  const [cycleId, setCycleId] = useState<string>(objective?.cycle_id ?? defaultCycleId ?? cycles[0]?.id ?? "");
  const [level, setLevel] = useState<"empresa" | "setor" | "individual">(objective?.level ?? "empresa");
  const [status, setStatus] = useState<"ativo" | "concluido" | "cancelado">(objective?.status ?? "ativo");

  const save = useMutation({
    mutationFn: () => upsertObjective({
      data: {
        id: objective?.id,
        cycle_id: cycleId,
        level,
        title,
        description,
        status,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["okr-objectives"] });
      toast.success(objective ? "Objetivo atualizado" : "Objetivo criado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro ao salvar"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{objective ? "Editar Objetivo" : "Novo Objetivo"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Título *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex: Elevar qualidade do atendimento" />
          </div>
          <div>
            <Label>Descrição</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Ciclo *</Label>
              <Select value={cycleId} onValueChange={setCycleId}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {cycles.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nível *</Label>
              <Select value={level} onValueChange={(v) => setLevel(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="empresa">Empresa</SelectItem>
                  <SelectItem value="setor">Setor</SelectItem>
                  <SelectItem value="individual">Individual</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          {objective && (
            <div>
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ativo">Ativo</SelectItem>
                  <SelectItem value="concluido">Concluído</SelectItem>
                  <SelectItem value="cancelado">Cancelado</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={!title || !cycleId || save.isPending}>
            {save.isPending ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
