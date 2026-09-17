import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { historicoCliente, historicoOS } from "@/lib/seu-instalador.functions";
import { asList, errorMessage, formatDateTime, pick } from "./shared";

interface Props {
  open: boolean;
  onClose: () => void;
  orderId?: string | null;
  clientId?: string | null;
  title?: string;
}

export function OsHistoricoDialog({ open, onClose, orderId, clientId, title }: Props) {
  const loadOrder = useServerFn(historicoOS);
  const loadClient = useServerFn(historicoCliente);

  const orderQuery = useQuery({
    queryKey: ["si-order-history", orderId],
    enabled: open && !!orderId,
    queryFn: () => loadOrder({ data: { orderId: orderId! } }),
  });

  const clientQuery = useQuery({
    queryKey: ["si-client-history", clientId],
    enabled: open && !!clientId,
    queryFn: () => loadClient({ data: { clientId: clientId!, page: 1, pageSize: 50 } }),
  });

  const renderList = (query: typeof orderQuery, empty: string) => {
    if (query.isLoading)
      return (
        <p className="text-sm text-muted-foreground flex items-center gap-2 py-6 justify-center">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando...
        </p>
      );
    if (query.isError) return <p className="text-sm text-destructive py-4">{errorMessage(query.error)}</p>;
    const rows = asList(query.data);
    if (rows.length === 0) return <p className="text-sm text-muted-foreground py-4">{empty}</p>;
    return (
      <ul className="space-y-2">
        {rows.map((r: any, i: number) => (
          <li key={r.id ?? i} className="rounded-md border border-border p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">
                {pick(r, ["title", "event", "action", "status", "serviceType", "description"], "Registro")}
              </span>
              <span className="text-xs text-muted-foreground">
                {formatDateTime(r.createdAt ?? r.occurredAt ?? r.scheduledAt ?? r.date)}
              </span>
            </div>
            {(r.description || r.notes || r.observacao) && (
              <p className="mt-1 text-xs text-muted-foreground">{r.description ?? r.notes ?? r.observacao}</p>
            )}
            {(r.technician || r.technicianName || r.user) && (
              <p className="mt-1 text-xs text-muted-foreground">
                {pick(r, ["technicianName", "technician", "user"])}
              </p>
            )}
          </li>
        ))}
      </ul>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{title || "Histórico"}</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue={orderId ? "os" : "cliente"}>
          <TabsList>
            <TabsTrigger value="os" disabled={!orderId}>
              Histórico da OS
            </TabsTrigger>
            <TabsTrigger value="cliente" disabled={!clientId}>
              Histórico do cliente
            </TabsTrigger>
          </TabsList>
          <TabsContent value="os" className="mt-4">
            {renderList(orderQuery, "Nenhum evento registrado nesta OS.")}
          </TabsContent>
          <TabsContent value="cliente" className="mt-4">
            {renderList(clientQuery as any, "Nenhum atendimento no histórico deste cliente.")}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
