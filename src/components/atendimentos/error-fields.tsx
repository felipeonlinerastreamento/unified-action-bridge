import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, AlertTriangle } from "lucide-react";
import { useOperatorOptions, formatBRL } from "@/hooks/use-ticket-errors";

export interface ErrorLineItem {
  operator_user_id: string | null;
  operator_name: string;
  description: string;
  amount: number;
}

interface Props {
  items: ErrorLineItem[];
  onChange: (items: ErrorLineItem[]) => void;
}

export function ErrorFields({ items, onChange }: Props) {
  const { data: operators = [] } = useOperatorOptions();

  const addLine = () =>
    onChange([...items, { operator_user_id: null, operator_name: "", description: "", amount: 0 }]);
  const updateLine = (idx: number, patch: Partial<ErrorLineItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeLine = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const total = items.reduce((acc, it) => acc + (Number(it.amount) || 0), 0);

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
        <div className="flex items-center justify-between">
          <Label className="text-xs">Lançamentos</Label>
          <Button type="button" variant="outline" size="sm" onClick={addLine} className="h-7 text-xs">
            <Plus className="h-3 w-3 mr-1" /> Adicionar
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Nenhum lançamento de erro.</p>
        ) : (
          items.map((it, idx) => (
            <div key={idx} className="flex flex-wrap items-end gap-2 rounded-md border bg-background p-2">
              <div className="flex-1 min-w-[160px]">
                <Label className="text-[10px] text-muted-foreground">Operador responsável</Label>
                <Select
                  value={it.operator_user_id || ""}
                  onValueChange={(v) => {
                    const op = operators.find((o) => o.user_id === v);
                    updateLine(idx, { operator_user_id: v, operator_name: op?.name || "" });
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {operators.map((o) => (
                      <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <Label className="text-[10px] text-muted-foreground">Descrição</Label>
                <Input
                  className="h-8 text-xs"
                  value={it.description}
                  onChange={(e) => updateLine(idx, { description: e.target.value })}
                  placeholder="O que ocorreu"
                />
              </div>
              <div className="w-[110px]">
                <Label className="text-[10px] text-muted-foreground">Valor (R$)</Label>
                <Input
                  className="h-8 text-xs"
                  type="number"
                  min={0}
                  step="0.01"
                  value={it.amount === 0 ? "" : it.amount}
                  onChange={(e) => updateLine(idx, { amount: e.target.value === "" ? 0 : Number(e.target.value) })}
                  placeholder="0,00"
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                onClick={() => removeLine(idx)}
              >
                <Trash2 className="h-3.5 w-3.5 text-destructive" />
              </Button>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

export function validateErrorItems(items: ErrorLineItem[]): string | null {
  for (const it of items) {
    if (!it.operator_user_id) return "Selecione o operador responsável em todos os lançamentos de erro.";
    if (Number(it.amount) < 0) return "Valor do erro deve ser maior ou igual a 0.";
  }
  return null;
}
