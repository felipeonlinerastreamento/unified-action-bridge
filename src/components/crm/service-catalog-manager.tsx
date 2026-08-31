import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Plus, Pencil, Trash2, Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export type CatalogService = {
  id: string;
  name: string;
  description: string;
  unit: string;
  default_activation: number;
  default_monthly: number;
  is_active: boolean;
  position: number;
};

export function useServiceCatalog() {
  return useQuery({
    queryKey: ["crm-service-catalog"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_service_catalog" as any)
        .select("*")
        .order("position")
        .order("name");
      if (error) throw error;
      return (data || []) as unknown as CatalogService[];
    },
  });
}

const empty = { name: "", description: "", unit: "Serviço", default_activation: 0, default_monthly: 0 };

export function ServiceCatalogManager({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: services = [], isLoading } = useServiceCatalog();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<any>(empty);

  const reset = () => { setEditingId(null); setDraft(empty); };
  const invalidate = () => qc.invalidateQueries({ queryKey: ["crm-service-catalog"] });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!draft.name.trim()) throw new Error("Informe o nome do serviço");
      const payload = {
        name: draft.name.trim(),
        description: draft.description || "",
        unit: draft.unit || "Serviço",
        default_activation: Number(draft.default_activation) || 0,
        default_monthly: Number(draft.default_monthly) || 0,
      };
      if (editingId) {
        const { error } = await supabase.from("crm_service_catalog" as any).update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("crm_service_catalog" as any).insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Serviço salvo"); reset(); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_service_catalog" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Serviço removido"); invalidate(); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="h-4 w-4" /> Catálogo de serviços da proposta
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="grid grid-cols-12 gap-2">
            <div className="col-span-12 sm:col-span-7">
              <Label className="text-[11px]">Serviço</Label>
              <Input className="h-8 text-xs" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Ex.: Vídeo monitoramento" />
            </div>
            <div className="col-span-4 sm:col-span-2">
              <Label className="text-[11px]">Unidade</Label>
              <Input className="h-8 text-xs" value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} placeholder="Serviço / Placa" />
            </div>
            <div className="col-span-4 sm:col-span-1.5">
              <Label className="text-[11px]">Ativação</Label>
              <Input type="number" min={0} step="0.01" className="h-8 text-xs" value={draft.default_activation || ""}
                onChange={(e) => setDraft({ ...draft, default_activation: e.target.value === "" ? 0 : Number(e.target.value) })} />
            </div>
            <div className="col-span-4 sm:col-span-1.5">
              <Label className="text-[11px]">Mensalidade</Label>
              <Input type="number" min={0} step="0.01" className="h-8 text-xs" value={draft.default_monthly || ""}
                onChange={(e) => setDraft({ ...draft, default_monthly: e.target.value === "" ? 0 : Number(e.target.value) })} />
            </div>
            <div className="col-span-12">
              <Label className="text-[11px]">Descrição (sai no PDF da proposta)</Label>
              <Textarea rows={2} className="text-xs" value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} />
            </div>
          </div>
          <div className="flex justify-end gap-2">
            {editingId && <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={reset}>Cancelar</Button>}
            <Button size="sm" className="h-7 text-xs" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
              {saveMut.isPending ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Plus className="h-3 w-3 mr-1" />}
              {editingId ? "Salvar" : "Adicionar serviço"}
            </Button>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-6"><Loader2 className="h-4 w-4 animate-spin" /></div>
        ) : services.length === 0 ? (
          <p className="text-xs text-muted-foreground italic py-4 text-center">Nenhum serviço cadastrado.</p>
        ) : (
          <div className="space-y-1.5">
            {services.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-2 rounded-md border border-border p-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{s.name}</p>
                  {s.description && <p className="text-[11px] text-muted-foreground line-clamp-2">{s.description}</p>}
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    <Badge variant="secondary" className="text-[10px]">{s.unit}</Badge>
                    <Badge variant="outline" className="text-[10px]">Ativação R$ {Number(s.default_activation).toFixed(2)}</Badge>
                    <Badge variant="outline" className="text-[10px]">Mensal R$ {Number(s.default_monthly).toFixed(2)}</Badge>
                  </div>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(s.id); setDraft({ name: s.name, description: s.description, unit: s.unit, default_activation: Number(s.default_activation), default_monthly: Number(s.default_monthly) }); }}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-7 w-7" disabled={deleteMut.isPending}
                    onClick={() => { if (confirm(`Remover "${s.name}"?`)) deleteMut.mutate(s.id); }}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
