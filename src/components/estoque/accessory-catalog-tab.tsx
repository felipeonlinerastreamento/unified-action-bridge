import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Pencil } from "lucide-react";
import { toast } from "sonner";

type Acc = { id?: string; name: string; tipo: string | null; modelo: string | null; saldo: number; estoque_minimo: number; ativo: boolean };
const empty: Acc = { name: "", tipo: "", modelo: "", saldo: 0, estoque_minimo: 0, ativo: true };

export function AccessoryCatalogTab({ canEdit }: { canEdit: boolean }) {
  const qc = useQueryClient();
  const { data = [] } = useQuery({
    queryKey: ["accessory-catalog"],
    queryFn: async () => (await supabase.from("accessory_catalog").select("*").order("name")).data ?? [],
  });
  const [edit, setEdit] = useState<Acc | null>(null);
  const save = async () => {
    if (!edit?.name.trim()) return toast.error("Informe o nome.");
    const payload = { name: edit.name.trim(), tipo: edit.tipo || null, modelo: edit.modelo || null, saldo: Number(edit.saldo) || 0, estoque_minimo: Number(edit.estoque_minimo) || 0, ativo: edit.ativo };
    const { error } = edit.id
      ? await supabase.from("accessory_catalog").update(payload).eq("id", edit.id)
      : await supabase.from("accessory_catalog").insert(payload);
    if (error) return toast.error(error.message);
    toast.success("Acessório salvo.");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["accessory-catalog"] });
  };
  return (
    <div className="space-y-3">
      {canEdit && <Button onClick={() => setEdit({ ...empty })}><Plus className="h-4 w-4 mr-1" />Novo acessório</Button>}
      <Card><CardContent className="p-0">
        <Table>
          <TableHeader><TableRow>
            <TableHead>Nome</TableHead><TableHead>Tipo</TableHead><TableHead>Modelo</TableHead>
            <TableHead>Saldo</TableHead><TableHead>Mínimo</TableHead><TableHead>Situação</TableHead><TableHead />
          </TableRow></TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Nenhum acessório cadastrado.</TableCell></TableRow>
            ) : data.map((a) => (
              <TableRow key={a.id}>
                <TableCell className="font-medium">{a.name}</TableCell>
                <TableCell>{a.tipo ?? "—"}</TableCell>
                <TableCell>{a.modelo ?? "—"}</TableCell>
                <TableCell>{a.saldo <= a.estoque_minimo ? <Badge variant="destructive">{a.saldo}</Badge> : a.saldo}</TableCell>
                <TableCell>{a.estoque_minimo}</TableCell>
                <TableCell>{a.ativo ? "Ativo" : <span className="text-muted-foreground">Inativo</span>}</TableCell>
                <TableCell>{canEdit && <Button size="sm" variant="ghost" onClick={() => setEdit(a)}><Pencil className="h-4 w-4" /></Button>}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent></Card>
      {edit && (
        <Dialog open onOpenChange={(o) => !o && setEdit(null)}>
          <DialogContent>
            <DialogHeader><DialogTitle>{edit.id ? "Editar acessório" : "Novo acessório"}</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <div><Label>Nome</Label><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="Sensor de temperatura" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label>Tipo</Label><Input value={edit.tipo ?? ""} onChange={(e) => setEdit({ ...edit, tipo: e.target.value })} placeholder="Sensor, Trava, Teclado..." /></div>
                <div><Label>Modelo</Label><Input value={edit.modelo ?? ""} onChange={(e) => setEdit({ ...edit, modelo: e.target.value })} /></div>
                <div><Label>Saldo</Label><Input type="number" value={edit.saldo} onChange={(e) => setEdit({ ...edit, saldo: Number(e.target.value) })} /></div>
                <div><Label>Estoque mínimo</Label><Input type="number" value={edit.estoque_minimo} onChange={(e) => setEdit({ ...edit, estoque_minimo: Number(e.target.value) })} /></div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={edit.ativo} onCheckedChange={(v) => setEdit({ ...edit, ativo: v })} /><Label>Ativo</Label></div>
            </div>
            <DialogFooter><Button variant="outline" onClick={() => setEdit(null)}>Cancelar</Button><Button onClick={save}>Salvar</Button></DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
