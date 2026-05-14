import { Badge } from "@/components/ui/badge";
import { Package, ShoppingCart, MapPin, Calendar } from "lucide-react";

/**
 * Bloco informativo exibido em cards de tickets do setor "Compras".
 * Mostra a descrição dos itens pedidos e o status do código de rastreio.
 */
export function ComprasInfo({ ticket }: { ticket: any }) {
  const sector = (ticket?.sector || "").toLowerCase();
  if (!sector.includes("compr")) return null;

  const items: any[] = Array.isArray(ticket.purchase_items) ? ticket.purchase_items : [];
  const req = ticket.purchase_request || null;
  const tr = Array.isArray(ticket.ticket_tracking) ? ticket.ticket_tracking[0] : ticket.ticket_tracking;
  const trackingCode = req?.tracking_code || tr?.tracking_code || ticket.tracking_code;

  if (items.length === 0 && !req && !trackingCode) return null;

  const reqStatusMap: Record<string, string> = {
    solicitado: "bg-amber-500 text-white",
    aprovado: "bg-blue-500 text-white",
    comprado: "bg-violet-600 text-white",
    enviado: "bg-indigo-600 text-white",
    recebido: "bg-emerald-600 text-white",
    cancelado: "bg-red-500 text-white",
  };

  const trackStatus = tr?.last_status;
  const delivered = tr?.is_delivered;

  return (
    <div className="mt-2 rounded-md border border-primary/20 bg-primary/5 p-2 space-y-1.5">
      {/* Descrição do pedido */}
      {items.length > 0 && (
        <div className="flex items-start gap-1.5 text-xs">
          <ShoppingCart className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <span className="font-medium">Pedido: </span>
            <span className="text-muted-foreground">
              {items
                .map((it) => `${it.quantity}x ${it.item_name}`)
                .join(", ")}
            </span>
          </div>
          {req?.status && (
            <Badge className={`text-[10px] capitalize ${reqStatusMap[req.status] || "bg-secondary"}`}>
              {req.status}
            </Badge>
          )}
        </div>
      )}

      {/* Status do rastreio */}
      {trackingCode && (
        <div className="flex items-center gap-1.5 text-xs flex-wrap">
          <Package className="h-3.5 w-3.5 text-primary shrink-0" />
          <Badge className={`text-[10px] ${delivered ? "bg-emerald-600 text-white" : "bg-blue-500 text-white"}`}>
            {delivered ? "Entregue" : trackStatus || "Aguardando consulta"}
          </Badge>
          <span className="font-mono text-[11px] text-muted-foreground">{trackingCode}</span>
          {tr?.last_location && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <MapPin className="h-3 w-3" /> {tr.last_location}
            </span>
          )}
          {req?.expected_delivery && !delivered && (
            <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
              <Calendar className="h-3 w-3" />
              Previsão: {new Date(req.expected_delivery).toLocaleDateString("pt-BR")}
            </span>
          )}
        </div>
      )}

      {/* Sem rastreio mas com pedido */}
      {!trackingCode && req && (
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Package className="h-3.5 w-3.5" />
          Sem código de rastreio
        </div>
      )}
    </div>
  );
}
