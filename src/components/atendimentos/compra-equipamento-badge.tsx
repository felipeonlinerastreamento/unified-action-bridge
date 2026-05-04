import { Badge } from "@/components/ui/badge";
import { Smartphone, CheckCircle2, Truck } from "lucide-react";

/**
 * Badge inline que mostra os itens de "Solicitação compra Equipamento/Chip"
 * (primeiro item + sufixo +N) e o status agregado (pendente/comprado/entregue).
 */
export function CompraEquipamentoBadge({ ticket }: { ticket: any }) {
  const items = Array.isArray(ticket.compra_equipamento_items)
    ? ticket.compra_equipamento_items
    : [];
  if (items.length === 0) return null;

  const pending = items.filter((i: any) => i.status === "pendente").length;
  const bought = items.filter((i: any) => i.status === "comprado").length;
  const delivered = items.filter((i: any) => i.status === "entregue").length;

  const first = items[0];
  const extra = items.length - 1;
  const itemLabel = first
    ? `${first.quantity}x ${first.item_name}${extra > 0 ? ` +${extra}` : ""}`
    : "";

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {itemLabel && (
        <Badge variant="outline" className="text-[10px] gap-0.5 h-5 max-w-[200px]">
          <Smartphone className="h-2.5 w-2.5 shrink-0" />
          <span className="truncate">{itemLabel}</span>
        </Badge>
      )}
      {pending > 0 && (
        <Badge variant="secondary" className="text-[10px] gap-0.5 h-5">
          {pending} pend{pending === 1 ? "ente" : "entes"}
        </Badge>
      )}
      {bought > 0 && (
        <Badge className="bg-amber-100 text-amber-800 border-amber-200 text-[10px] gap-0.5 h-5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {bought} comprado{bought === 1 ? "" : "s"}
        </Badge>
      )}
      {delivered > 0 && (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-0.5 h-5">
          <Truck className="h-2.5 w-2.5" />
          {delivered} entregue{delivered === 1 ? "" : "s"}
        </Badge>
      )}
    </div>
  );
}
