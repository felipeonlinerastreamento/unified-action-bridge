import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { AlertTriangle, Plus, Trash2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  isErrorCategory, formatBRL, useOperatorOptions, useTicketErrorEntries,
} from "@/hooks/use-ticket-errors";

interface Props {
  ticket: any;
  userId: string | null;
  onRefetch: () => void;
}

export function TicketErrorSection({ ticket, userId, onRefetch }: Props) {
  const isErr = isErrorCategory(ticket?.category);
  const { data: entries = [], refetch } = useTicketErrorEntries(isErr ? ticket?.id : null);
  const { data: operators = [] } = useOperatorOptions(isErr);
  const [operatorId, setOperatorId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState<string>("");
  const [adding, setAdding] = useState(false);

  const remove = useMutation({
    mutationFn: async (entry: any) => {
      const { error } = await supabase
        .from("ticket_error_entries" as any)
        .delete()
        .eq("id", entry.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetch();
      onRefetch();
    },
    onError: (e: any) => toast.error(e?.message || "Erro ao remover"),
  });

  const addEntry = async () => {
    if (!operatorId) {
      toast.error("Selecione o operador responsável");
      return;
    }
    const op = operators.find((o) => o.user_id === operatorId);
    setAdding(true);
    try {
      const { error } = await supabase.from("ticket_error_entries" as any).insert({
        ticket_id: ticket.id,
        operator_user_id: operatorId,
        operator_name: op?.name || "",
        description: description.trim() || null,
        amount: Math.max(0, Number(amount) || 0),
        created_by: userId,
      });
      if (error) throw error;
      setOperatorId("");
      setDescription("");
      setAmount("");
      refetch();
      onRefetch();
      toast.success("Erro registrado");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao registrar");
    } finally {
      setAdding(false);
    }
  };

  if (!isErr) return null;

  const total = entries.reduce((acc, e) => acc + Number(e.amount || 0), 0);

  return (
    <Card className="p-3 space-y-3 border-destructive/30 bg-destructive/5">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-destructive" />
          <span className="text-sm font-semibold">Erro / Prejuízo</span>
        </div>
        <span className="text-xs font-semibold">Total: {formatBRL(total)}</span>
      </div>

      <div className="space-y-2">
        {entries.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum lançamento registrado.</p>
        ) : (
          <div className="space-y-1">
            {entries.map((e) => (
              <div
                key={e.id}
                className="flex items-center gap-2 rounded-md border px-2 py-1.5 text-xs bg-background"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="flex-1 truncate">
                  <span className="font-medium">{e.operator_name || "—"}</span>
                  {e.description ? ` — ${e.description}` : ""}
                </span>
                <span className="font-semibold w-24 text-right">{formatBRL(e.amount)}</span>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => remove.mutate(e)}
                  disabled={remove.isPending}
                >
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-1 pt-1 border-t border-destructive/20">
          <Select value={operatorId} onValueChange={setOperatorId}>
            <SelectTrigger className="h-8 flex-1 min-w-[140px] text-xs">
              <SelectValue placeholder="Operador responsável..." />
            </SelectTrigger>
            <SelectContent>
              {operators.map((o) => (
                <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            className="h-8 flex-1 min-w-[140px] text-xs"
            placeholder="Descrição"
            value={description}
            onChange={(ev) => setDescription(ev.target.value)}
          />
          <Input
            className="h-8 w-[100px] text-xs"
            type="number"
            min={0}
            step="0.01"
            placeholder="Valor"
            value={amount}
            onChange={(ev) => setAmount(ev.target.value)}
          />
          <Button size="sm" className="h-8 text-xs" onClick={addEntry} disabled={adding}>
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>
      </div>
    </Card>
  );
}
