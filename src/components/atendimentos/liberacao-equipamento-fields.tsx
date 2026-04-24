import { useLiberacaoCatalog } from "@/hooks/use-liberacao-equipamento";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card } from "@/components/ui/card";
import { Plus, Trash2, Package, CalendarDays } from "lucide-react";

export interface LiberacaoLineItem {
  item_id: string | null;
  item_name: string;
  quantity: number;
}

interface LiberacaoEquipamentoFieldsProps {
  items: LiberacaoLineItem[];
  onChange: (items: LiberacaoLineItem[]) => void;
  liberacaoDate: string;
  onLiberacaoDateChange: (value: string) => void;
}

export function LiberacaoEquipamentoFields({
  items,
  onChange,
  liberacaoDate,
  onLiberacaoDateChange,
}: LiberacaoEquipamentoFieldsProps) {
  const { data: catalog = [], isLoading } = useLiberacaoCatalog();

  const addLine = () => {
    onChange([...items, { item_id: null, item_name: "", quantity: 1 }]);
  };

  const updateLine = (idx: number, patch: Partial<LiberacaoLineItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };

  const removeLine = (idx: number) => {
    onChange(items.filter((_, i) => i !== idx));
  };

  return (
    <Card className="p-3 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2">
        <Package className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Liberação de Equipamento</span>
      </div>

      <div className="space-y-1">
        <Label className="text-xs flex items-center gap-1">
          <CalendarDays className="h-3 w-3" />
          Data de liberação
        </Label>
        <Input
          type="date"
          value={liberacaoDate}
          onChange={(e) => onLiberacaoDateChange(e.target.value)}
          className="h-9"
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Itens a liberar</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addLine}
            className="h-7 text-xs"
          >
            <Plus className="h-3 w-3 mr-1" /> Adicionar item
          </Button>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">
            Nenhum item adicionado. Clique em "Adicionar item" acima.
          </p>
        ) : (
          <div className="space-y-2">
            {items.map((line, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <Select
                  value={line.item_id || ""}
                  onValueChange={(v) => {
                    const item = catalog.find((c) => c.id === v);
                    updateLine(idx, {
                      item_id: v,
                      item_name: item?.name || line.item_name,
                    });
                  }}
                >
                  <SelectTrigger className="h-9 flex-1">
                    <SelectValue
                      placeholder={isLoading ? "Carregando..." : "Selecione o item..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {catalog.length === 0 ? (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhum item cadastrado em Configurações.
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
                  value={line.quantity}
                  onChange={(e) =>
                    updateLine(idx, { quantity: Math.max(1, parseInt(e.target.value, 10) || 1) })
                  }
                  className="h-9 w-20"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(idx)}
                  className="h-9 w-9"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}

export function validateLiberacaoItems(items: LiberacaoLineItem[]): string | null {
  if (items.length === 0) return "Adicione ao menos um item para liberação.";
  for (const it of items) {
    if (!it.item_id || !it.item_name) return "Selecione o item em todas as linhas.";
    if (!it.quantity || it.quantity < 1) return "Quantidade deve ser maior que 0.";
  }
  return null;
}
