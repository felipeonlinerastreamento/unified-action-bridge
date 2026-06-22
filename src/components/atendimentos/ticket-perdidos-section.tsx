import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PackageX, Plus, Trash2 } from "lucide-react";
import {
  usePerdidosCatalog,
  useTicketPerdidosItems,
  isPerdidosCategory,
  formatBRL,
} from "@/hooks/use-perdidos";
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

export function TicketPerdidosSection({ ticket, userId, onRefetch }: Props) {
  const isPer = isPerdidosCategory(ticket?.category);
  const { data: items = [], refetch } = useTicketPerdidosItems(isPer ? ticket?.id : null);
  const { data: catalog = [] } = usePerdidosCatalog(isPer);
  const [newItemId, setNewItemId] = useState<string>("");
  const [newQty, setNewQty] = useState(1);
  const [newValue, setNewValue] = useState(0);
  const [adding, setAdding] = useState(false);

  const remove = useMutation({
    mutationFn: async (item: any) => {
      const { error } = await supabase
        .from("ticket_perdidos_items" as any)
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
      const { error } = await supabase.from("ticket_perdidos_items" as any).insert({
        ticket_id: ticket.id,
        item_id: cat.id,
        item_name: cat.name,
        quantity: Math.max(1, newQty),
        unit_value: Math.max(0, newValue),
        created_by: userId,
      });
      if (error) throw error;
      setNewItemId("");
      setNewQty(1);
      setNewValue(0);
      refetch();
      onRefetch();
      toast.success("Item adicionado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao adicionar");
    } finally {
      setAdding(false);
    }
  };

  if (!isPer) return null;

  const total = items.reduce((acc, it) => acc + Number(it.total_value || 0), 0);

  return (
    <Card className="p-3 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <PackageX className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Itens Perdidos</span>
        </div>
        <span className="text-xs font-semibold">Total: {formatBRL(total)}</span>
      </div>

      <div className="space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum item registrado.</p>
        ) : (
          <div className="space-y-1">
            {items.map((it) => (
              <div
                key={it.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs bg-background"
              >
                <PackageX className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">
                  <span className="font-medium">{it.quantity}x</span> {it.item_name}
                </span>
                <span className="text-muted-foreground">{formatBRL(it.unit_value)}</span>
                <span className="font-semibold w-20 text-right">{formatBRL(it.total_value)}</span>
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
            ))}
          </div>
        )}

        <div className="flex items-center gap-1 pt-1 border-t border-primary/20">
          <Select
            value={newItemId}
            onValueChange={(v) => {
              setNewItemId(v);
              const cat = catalog.find((c) => c.id === v);
              if (cat?.default_quantity) setNewQty(cat.default_quantity);
              if (cat?.default_unit_value !== undefined) setNewValue(Number(cat.default_unit_value) || 0);
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
            className="h-8 w-14 text-xs"
            title="Quantidade"
          />
          <Input
            type="number"
            min={0}
            step="0.01"
            value={newValue || ""}
            onChange={(e) => { const r = e.target.value; setNewValue(r === "" ? 0 : parseFloat(r) || 0); }}
            className="h-8 w-20 text-xs"
            title="Valor unitário"
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
