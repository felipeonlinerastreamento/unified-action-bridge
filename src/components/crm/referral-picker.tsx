import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Plus, Pencil, Check, X, Trash2, Tag } from "lucide-react";
import { toast } from "sonner";

interface Props {
  value?: string | null;
  onChange: (id: string | null) => void;
  label?: string;
}

interface ReferralItem {
  id: string;
  name: string;
}

const getErrorMessage = (error: unknown) =>
  error instanceof Error ? error.message : "Não foi possível salvar a indicação";

export function ReferralPicker({ value, onChange, label = "Indicação" }: Props) {
  const qc = useQueryClient();
  const [managerOpen, setManagerOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const { data: items = [] } = useQuery<ReferralItem[]>({
    queryKey: ["crm-referrals"],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_referrals")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      return data || [];
    },
    staleTime: 30_000,
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const name = draft.trim();
      if (!name) throw new Error("Informe o nome");
      const { error } = await supabase.from("crm_referrals").insert({ name });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["crm-referrals"] });
      toast.success("Indicação criada");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const updateMut = useMutation({
    mutationFn: async () => {
      if (!editingId || !editingName.trim()) throw new Error("Informe o nome");
      const { error } = await supabase
        .from("crm_referrals")
        .update({ name: editingName.trim() })
        .eq("id", editingId);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditingName("");
      qc.invalidateQueries({ queryKey: ["crm-referrals"] });
      toast.success("Atualizada");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("crm_referrals").delete().eq("id", id);
      if (error) throw error;
      return id;
    },
    onSuccess: (id) => {
      if (value === id) onChange(null);
      qc.invalidateQueries({ queryKey: ["crm-referrals"] });
      toast.success("Removida");
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  return (
    <div className="rounded-md border border-border bg-muted/30 p-2 space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-7 px-2 text-xs"
          onClick={() => setManagerOpen((open) => !open)}
        >
          {managerOpen ? "Fechar" : "Gerenciar"}
        </Button>
      </div>
      <Select value={value || "none"} onValueChange={(v) => onChange(v === "none" ? null : v)}>
        <SelectTrigger className="h-9"><SelectValue placeholder="Selecione..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Sem indicação</SelectItem>
          {items.map((c) => (
            <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {managerOpen && <div className="rounded-md border border-border bg-background p-2 space-y-2">
        <div className="flex gap-2">
          <Input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Nova indicação"
            className="h-8 text-xs"
          />
          <Button
            type="button"
            size="sm"
            className="h-8 shrink-0 px-3 text-xs"
            onClick={() => createMut.mutate()}
            disabled={!draft.trim() || createMut.isPending}
          >
            {createMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            Adicionar
          </Button>
        </div>
        <div className="max-h-32 overflow-y-auto space-y-1">
          {items.length === 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1 py-1">
              <Tag className="h-3 w-3" /> Nenhuma indicação
            </p>
          ) : items.map((c) => (
            <div key={c.id} className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-accent/50">
              {editingId === c.id ? (
                <>
                  <Input value={editingName} onChange={(e) => setEditingName(e.target.value)} className="h-7 text-xs" autoFocus />
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => updateMut.mutate()} disabled={!editingName.trim() || updateMut.isPending}>
                    {updateMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                    Salvar
                  </Button>
                  <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => { setEditingId(null); setEditingName(""); }}>
                    <X className="h-3 w-3" />
                  </Button>
                </>
              ) : (
                <>
                  <button type="button" className="flex-1 truncate text-left text-xs py-1" onClick={() => onChange(c.id)}>
                    {value === c.id ? "✓ " : ""}{c.name}
                  </button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { setEditingId(c.id); setEditingName(c.name); }}>
                    <Pencil className="h-3 w-3" />
                    Editar
                  </Button>
                  <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => { if (confirm("Remover indicação?")) deleteMut.mutate(c.id); }} disabled={deleteMut.isPending}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                    Excluir
                  </Button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>}
    </div>
  );
}
