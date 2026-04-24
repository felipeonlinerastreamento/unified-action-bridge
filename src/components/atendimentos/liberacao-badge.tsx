import { Badge } from "@/components/ui/badge";
import { Package, CheckCircle2 } from "lucide-react";

/**
 * Badge inline para mostrar pendentes/liberados de equipamento em um ticket
 * individual nas visualizações de lista e kanban.
 */
export function LiberacaoBadge({ ticket }: { ticket: any }) {
  const items = Array.isArray(ticket.liberacao_items) ? ticket.liberacao_items : [];
  if (items.length === 0) return null;
  const pending = items.filter((i: any) => i.status === "pendente").length;
  const released = items.filter((i: any) => i.status === "liberado").length;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let isOverdue = false;
  if (pending > 0 && ticket.liberacao_date) {
    const d = new Date(ticket.liberacao_date);
    d.setHours(0, 0, 0, 0);
    isOverdue = d < today;
  }

  return (
    <div className="flex items-center gap-1 flex-wrap">
      {pending > 0 && (
        <Badge
          variant={isOverdue ? "destructive" : "secondary"}
          className="text-[10px] gap-0.5 h-5"
        >
          <Package className="h-2.5 w-2.5" />
          {pending} pend{pending === 1 ? "ente" : "entes"}
          {isOverdue && " (atrasado)"}
        </Badge>
      )}
      {released > 0 && (
        <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200 text-[10px] gap-0.5 h-5">
          <CheckCircle2 className="h-2.5 w-2.5" />
          {released} liberado{released === 1 ? "" : "s"}
        </Badge>
      )}
    </div>
  );
}
