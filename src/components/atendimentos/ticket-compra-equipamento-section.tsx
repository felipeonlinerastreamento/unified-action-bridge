import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Smartphone, CheckCircle2, Truck, Plus, Trash2 } from "lucide-react";
import {
  useCompraEquipamentoCatalog,
  useTicketCompraEquipamentoItems,
  isCompraEquipamentoCategory,
} from "@/hooks/use-compra-equipamento";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Props {
  ticket: any;
  userId: string | null;
  onRefetch: () => void;
}

export function TicketCompraEquipamentoSection({ ticket, userId, onRefetch }: Props) {
  const isCE = isCompraEquipamentoCategory(ticket?.category);
  const { data: items = [], refetch } = useTicketCompraEquipamentoItems(isCE ? ticket?.id : null);
  const { data: catalog = [] } = useCompraEquipamentoCatalog(isCE);
  const [newItemId, setNewItemId] = useState<string>("");
  const [newQty, setNewQty] = useState(1);
  const [adding, setAdding] = useState(false);

  const setStatus = useMutation({
    mutationFn: async ({ item, status }: { item: any; status: string }) => {
      const patch: any = { status, updated_at: new Date().toISOString() };
      if (status === "entregue") {
        patch.delivered_at = new Date().toISOString();
        patch.delivered_by = userId;
      } else {
        patch.delivered_at = null;
        patch.delivered_by = null;
      }
      const { error } = await supabase
        .from("ticket_compra_equipamento_items" as any)
        .update(patch)
        .eq("id", item.id);
      if (error) throw error;
      await supabase.from("ticket_comments").insert({
        ticket_id: ticket.id,
        user_id: userId,
        content: `Compra equipamento "${item.quantity}x ${item.item_name}" → ${status}`,
        comment_type: "sistema",
      });
    },
    onSuccess: () => {
      refetch();
      onRefetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao atualizar"),
  });

  const remove = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase
        .from("ticket_compra_equipamento_items" as any)
        .delete()
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      onRefetch();
    },
  });

  const addItem = async () => {
    if (!newItemId) return;
    const cat = catalog.find((c) => c.id === newItemId);
    if (!cat) return;
    setAdding(true);
    try {
      const { error } = await supabase.from("ticket_compra_equipamento_items" as any).insert({
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
      onRefetch();
      toast.success("Item adicionado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  if (!isCE) return null;

  const pending = items.filter((i) => i.status === "pendente").length;
  const bought = items.filter((i) => i.status === "comprado").length;
  const delivered = items.filter((i) => i.status === "entregue").length;

  return (
    <Card className="p-3 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Smartphone className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Compra Equipamento/Chip</span>
        </div>
        <div className="flex gap-1 flex-wrap">
          {pending > 0 && (
            <Badge variant="secondary" className="text-xs">{pending} pendente{pending > 1 ? "s" : ""}</Badge>
          )}
          {bought > 0 && (
            <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-xs">{bought} comprado{bought > 1 ? "s" : ""}</Badge>
          )}
          {delivered > 0 && (
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-xs">{delivered} entregue{delivered > 1 ? "s" : ""}</Badge>
          )}
        </div>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum item registrado.</p>
        ) : (
          <div className="space-y-1">
            {items.map((it) => {
              const isDelivered = it.status === "entregue";
              const isBought = it.status === "comprado";
              return (
                <div
                  key={it.id}
                  className={`flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs ${
                    isDelivered
                      ? "bg-emerald-50 border-emerald-200"
                      : isBought
                      ? "bg-amber-50 border-amber-200"
                      : "bg-background"
                  }`}
                >
                  <Smartphone className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="flex-1 truncate">
                    <span className="font-medium">{it.quantity}x</span> {it.item_name}
                  </span>
                  <Badge
                    variant="outline"
                    className={`text-[10px] ${
                      isDelivered
                        ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : isBought
                        ? "bg-amber-100 text-amber-800 border-amber-200"
                        : ""
                    }`}
                  >
                    {it.status}
                  </Badge>
                  {!isBought && !isDelivered && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 text-[10px]"
                      onClick={() => setStatus.mutate({ item: it, status: "comprado" })}
                      disabled={setStatus.isPending}
                    >
                      <CheckCircle2 className="h-3 w-3 mr-1" /> Comprado
                    </Button>
                  )}
                  {!isDelivered && (
                    <Button
                      size="sm"
                      className="h-6 text-[10px]"
                      onClick={() => setStatus.mutate({ item: it, status: "entregue" })}
                      disabled={setStatus.isPending}
                    >
                      <Truck className="h-3 w-3 mr-1" /> Entregue
                    </Button>
                  )}
                  {(isBought || isDelivered) && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px]"
                      onClick={() => setStatus.mutate({ item: it, status: "pendente" })}
                      disabled={setStatus.isPending}
                    >
                      Reverter
                    </Button>
                  )}
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => remove.mutate(it)}
                    disabled={remove.isPending}
                  >
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-1 pt-1 border-t border-primary/20">
          <Select
            value={newItemId}
            onValueChange={(v) => {
              setNewItemId(v);
              const cat = catalog.find((c) => c.id === v);
              if (cat?.default_quantity) setNewQty(cat.default_quantity);
            }}
          >
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
            value={newQty || ""}
            onChange={(e) => { const r = e.target.value; setNewQty(r === "" ? 0 : parseInt(r, 10) || 0); }}
            className="h-8 w-16 text-xs"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={addItem}
            disabled={!newItemId || adding}
          >
            <Plus className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}
