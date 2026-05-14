import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createCheckin, listCheckins } from "@/lib/okr.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function CheckinDialog({
  open, onOpenChange, keyResult,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  keyResult: any;
}) {
  const qc = useQueryClient();
  const [newValue, setNewValue] = useState<string>(String(keyResult.current_value));
  const [confidence, setConfidence] = useState<"verde" | "amarelo" | "vermelho">(keyResult.confidence ?? "verde");
  const [comment, setComment] = useState("");

  const historyQ = useQuery({
    queryKey: ["okr-checkins", keyResult.id],
    queryFn: () => listCheckins({ data: { key_result_id: keyResult.id } }),
    enabled: open,
  });

  const save = useMutation({
    mutationFn: () => createCheckin({
      data: {
        key_result_id: keyResult.id,
        new_value: Number(newValue) || 0,
        confidence,
        comment,
      },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["okr-objectives"] });
      qc.invalidateQueries({ queryKey: ["okr-checkins", keyResult.id] });
      toast.success("Check-in registrado");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Check-in: {keyResult.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Novo valor *</Label>
              <Input type="number" value={newValue} onChange={(e) => setNewValue(e.target.value)} />
            </div>
            <div>
              <Label>Confiança *</Label>
              <Select value={confidence} onValueChange={(v) => setConfidence(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="verde">🟢 No prazo</SelectItem>
                  <SelectItem value="amarelo">🟡 Atenção</SelectItem>
                  <SelectItem value="vermelho">🔴 Em risco</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Comentário</Label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="O que aconteceu nesta semana?" />
          </div>
          {historyQ.data && historyQ.data.length > 0 && (
            <div className="border rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Histórico</p>
              {historyQ.data.map((c) => (
                <div key={c.id} className="text-xs border-l-2 pl-2" style={{ borderColor: c.confidence === "verde" ? "#22c55e" : c.confidence === "amarelo" ? "#eab308" : "#ef4444" }}>
                  <div className="flex justify-between">
                    <span className="font-mono">{Number(c.previous_value)} → {Number(c.new_value)}</span>
                    <span className="text-muted-foreground">{format(new Date(c.created_at), "dd/MM HH:mm", { locale: ptBR })}</span>
                  </div>
                  {c.comment && <p className="text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{c.comment}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending ? "Registrando…" : "Registrar check-in"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
