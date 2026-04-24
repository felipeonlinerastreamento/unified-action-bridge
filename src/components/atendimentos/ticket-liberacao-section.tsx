import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Package, CheckCircle2, Loader2, CalendarDays, Plus, Trash2 } from "lucide-react";
import {
  useLiberacaoCatalog,
  useTicketLiberacaoItems,
  isLiberacaoCategory,
} from "@/hooks/use-liberacao-equipamento";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TicketLiberacaoSectionProps {
  ticket: any;
  userId: string | null;
  onRefetch: () => void;
}

export function TicketLiberacaoSection({ ticket, userId, onRefetch }: TicketLiberacaoSectionProps) {
  const qc = useQueryClient();
  const isLiberacao = isLiberacaoCategory(ticket?.category);
  const { data: items = [], refetch } = useTicketLiberacaoItems(isLiberacao ? ticket?.id : null);
  const { data: catalog = [] } = useLiberacaoCatalog(isLiberacao);
  const [liberacaoDate, setLiberacaoDate] = useState<string>(
    ticket?.liberacao_date ? String(ticket.liberacao_date).slice(0, 10) : ""
  );
  const [savingDate, setSavingDate] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newItemId, setNewItemId] = useState<string>("");
  const [newQty, setNewQty] = useState(1);

  const liberar = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase
        .from("ticket_liberacao_items" as any)
        .update({
          status: "liberado",
          liberado_at: new Date().toISOString(),
          liberado_by: userId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) throw error;
      await supabase.from("ticket_comments").insert({
        ticket_id: ticket.id,
        user_id: userId,
        content: `Item liberado: ${item.quantity}x ${item.item_name}`,
        comment_type: "sistema",
      });
    },
    onSuccess: () => {
      toast.success("Item liberado");
      refetch();
      qc.invalidateQueries({ queryKey: ["lab-liberacao"] });
      onRefetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao liberar"),
  });

  const reverter = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase
        .from("ticket_liberacao_items" as any)
        .update({
          status: "pendente",
          liberado_at: null,
          liberado_by: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Liberação revertida");
      refetch();
      qc.invalidateQueries({ queryKey: ["lab-liberacao"] });
      onRefetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro"),
  });

  const remove = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase
        .from("ticket_liberacao_items" as any)
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      qc.invalidateQueries({ queryKey: ["lab-liberacao"] });
    },
  });

  const saveDate = async () => {
    setSavingDate(true);
    try {
      const iso = liberacaoDate ? new Date(liberacaoDate + "T12:00:00").toISOString() : null;
      const { error } = await supabase
        .from("service_tickets")
        .update({ liberacao_date: iso, updated_at: new Date().toISOString() })
        .eq("id", ticket.id);
      if (error) throw error;
      toast.success("Data de liberação atualizada");
      onRefetch();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao salvar data");
    } finally {
      setSavingDate(false);
    }
  };

  const addItem = async () => {
    if (!newItemId) return;
    const cat = catalog.find((c) => c.id === newItemId);
    if (!cat) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("ticket_liberacao_items" as any).insert({
        ticket_id: ticket.id,
        item_id: cat.id,
        item_name: cat.name,
        quantity: Math.max(1, newQty),
        status: "pendente",
      });
      if (error) throw error;
      setNewItemId("");
      setNewQty(1);
      refetch();
      qc.invalidateQueries({ queryKey: ["lab-liberacao"] });
      toast.success("Item adicionado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  const pendentes = items.filter((i) => i.status === "pendente").length;
  const liberados = items.filter((i) => i.status === "liberado").length;

  return (
    <Card className="p-3 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Liberação de Equipamento</span>
        </div>
        <div className="flex gap-1">
          {pendentes > 0 && (
            <Badge variant="secondary" className="text-xs">
              {pendentes} pendente{pendentes > 1 ? "s" : ""}
            </Badge>
          )}
          {liberados > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">
              {liberados} liberado{liberados > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </div>

      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <CalendarDays className="h-3 w-3" /> Data de liberação
        </Label>
        <div className="flex gap-2">
          <Input
            type="date"
            value={liberacaoDate}
            onChange={(e) => setLiberacaoDate(e.target.value)}
            className="h-8 text-xs"
          />
          <Button size="sm" variant="outline" className="h-8" onClick={saveDate} disabled={savingDate}>
            {savingDate ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum item registrado.</p>
        ) : (
          <div className="space-y-1">
            {items.map((it) => {
              const isLiberado = it.status === "liberado";
              return (
                <div
                  key={it.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    isLiberado ? "bg-emerald-50 border-emerald-200" : "bg-background"
                  }`}
                >
                  <Package className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{it.quantity}x</span> {it.item_name}
                  </span>
                  {isLiberado ? (
                    <>
                      <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px]">
                        Liberado
                      </Badge>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 text-[10px]"
                        onClick={() => reverter.mutate(it)}
                        disabled={reverter.isPending}
                      >
                        Reverter
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        size="sm"
                        className="h-6 text-[10px] gap-1"
                        onClick={() => liberar.mutate(it)}
                        disabled={liberar.isPending}
                      >
                        <CheckCircle2 className="h-3 w-3" /> Liberar
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => remove.mutate(it)}
                        disabled={remove.isPending}
                      >
                        <Trash2 className="h-3 w-3 text-destructive" />
                      </Button>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 pt-1 border-t border-primary/20">
          <Select value={newItemId} onValueChange={setNewItemId}>
            <SelectTrigger className="h-8 flex-1 text-xs">
              <SelectValue placeholder="Adicionar item..." />
            </SelectTrigger>
            <SelectContent>
              {catalog.length === 0 ? (
                <div className="px-2 py-1.5 text-xs text-muted-foreground">
                  Nenhum item no catálogo.
                </div>
              ) : (
                catalog.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))
              )}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min={1}
            value={newQty}
            onChange={(e) => setNewQty(Math.max(1, parseInt(e.target.value, 10) || 1))}
            className="h-8 w-16 text-xs"
          />
          <Button size="sm" variant="outline" className="h-8" onClick={addItem} disabled={!newItemId || adding}>
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
