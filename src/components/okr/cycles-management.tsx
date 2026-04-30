import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Plus, Trash2, Pencil } from "lucide-react";
import { listOkrCycles, upsertOkrCycle, deleteOkrCycle } from "@/lib/okr.functions";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export function OkrCyclesManagement() {
  const qc = useQueryClient();
  const cyclesQ = useQuery({ queryKey: ["okr-cycles"], queryFn: () => listOkrCycles() });
  const [editing, setEditing] = useState<any | null>(null);
  const [name, setName] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [active, setActive] = useState(true);

  const reset = () => { setEditing(null); setName(""); setStart(""); setEnd(""); setActive(true); };
  const startEdit = (c: any) => {
    setEditing(c); setName(c.name);
    setStart(c.start_date); setEnd(c.end_date); setActive(c.is_active);
  };

  const save = useMutation({
    mutationFn: () => upsertOkrCycle({
      data: { id: editing?.id, name, start_date: start, end_date: end, is_active: active },
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["okr-cycles"] });
      toast.success(editing ? "Ciclo atualizado" : "Ciclo criado");
      reset();
    },
    onError: (e: any) => toast.error(e.message ?? "Erro"),
  });

  const del = useMutation({
    mutationFn: (id: string) => deleteOkrCycle({ data: { id } }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["okr-cycles"] }); toast.success("Ciclo removido"); },
    onError: (e: any) => toast.error(e.message ?? "Erro (verifique se há objetivos no ciclo)"),
  });

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{editing ? "Editar ciclo" : "Novo ciclo"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label>Nome *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Q2/2026" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Início *</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label>Fim *</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Switch checked={active} onCheckedChange={setActive} />
            <Label>Ativo</Label>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => save.mutate()} disabled={!name || !start || !end || save.isPending}>
              <Plus className="h-4 w-4 mr-1" /> {editing ? "Atualizar" : "Criar"}
            </Button>
            {editing && <Button variant="outline" onClick={reset}>Cancelar</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Ciclos cadastrados</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {(cyclesQ.data ?? []).map(c => (
            <div key={c.id} className="flex items-center gap-2 p-2 border rounded-md">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{c.name} {!c.is_active && <span className="text-xs text-muted-foreground">(inativo)</span>}</p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(c.start_date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })} → {format(new Date(c.end_date + "T00:00:00"), "dd/MM/yy", { locale: ptBR })}
                </p>
              </div>
              <Button size="sm" variant="ghost" onClick={() => startEdit(c)}><Pencil className="h-3.5 w-3.5" /></Button>
              <Button size="sm" variant="ghost" onClick={() => { if (confirm("Remover ciclo?")) del.mutate(c.id); }}>
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          ))}
          {!cyclesQ.data?.length && <p className="text-sm text-muted-foreground">Nenhum ciclo cadastrado.</p>}
        </CardContent>
      </Card>
    </div>
  );
}
