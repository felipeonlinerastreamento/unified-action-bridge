import { useSuprimentoCatalog } from "@/hooks/use-suprimento";
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
import { Plus, Trash2, ShoppingCart } from "lucide-react";

export interface SuprimentoLineItem {
  item_id: string | null;
  item_name: string;
  quantity: number;
}

interface SuprimentoFieldsProps {
  items: SuprimentoLineItem[];
  onChange: (items: SuprimentoLineItem[]) => void;
}

export function SuprimentoFields({ items, onChange }: SuprimentoFieldsProps) {
  const { data: catalog = [], isLoading } = useSuprimentoCatalog();

  const addLine = () =>
    onChange([...items, { item_id: null, item_name: "", quantity: 1 }]);
  const updateLine = (idx: number, patch: Partial<SuprimentoLineItem>) => {
    const next = [...items];
    next[idx] = { ...next[idx], ...patch };
    onChange(next);
  };
  const removeLine = (idx: number) =>
    onChange(items.filter((_, i) => i !== idx));

  return (
    <Card className="p-3 space-y-3 border-primary/30 bg-primary/5">
      <div className="flex items-center gap-2">
        <ShoppingCart className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">Itens de Compra</span>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label className="text-xs">Itens solicitados</Label>
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
                      quantity: item?.default_quantity || line.quantity || 1,
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
                        Nenhum item cadastrado em Configurações → Encaminhamento.
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
                  value={line.quantity || ""}
                  onChange={(e) => {
                    const r = e.target.value;
                    updateLine(idx, { quantity: r === "" ? 0 : parseInt(r, 10) || 0 });
                  }}
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

export function validateSuprimentoItems(items: SuprimentoLineItem[]): string | null {
  if (items.length === 0) return "Adicione ao menos um item de compra.";
  for (const it of items) {
    if (!it.item_id || !it.item_name) return "Selecione o item em todas as linhas.";
    if (!it.quantity || it.quantity < 1) return "Quantidade deve ser maior que 0.";
  }
  return null;
}
