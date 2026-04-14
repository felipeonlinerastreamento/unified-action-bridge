import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle, RotateCcw } from "lucide-react";

interface TicketKpisProps {
  tickets: any[];
}

export function TicketKpis({ tickets }: TicketKpisProps) {
  const abertos = tickets.filter((t) => t.status === "aberto" || t.status === "reaberto").length;
  const emAndamento = tickets.filter((t) => t.status === "em_andamento").length;
  const today = new Date().toDateString();
  const finalizadosHoje = tickets.filter(
    (t) => t.status === "finalizado" && t.closed_at && new Date(t.closed_at).toDateString() === today
  ).length;
  const reabertos = tickets.filter((t) => t.status === "reaberto").length;

  const kpis = [
    { label: "Abertos", value: abertos, icon: AlertCircle, color: "text-amber-500" },
    { label: "Em Andamento", value: emAndamento, icon: Clock, color: "text-blue-500" },
    { label: "Finalizados Hoje", value: finalizadosHoje, icon: CheckCircle, color: "text-emerald-500" },
    { label: "Reabertos", value: reabertos, icon: RotateCcw, color: "text-orange-500" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => (
        <Card key={kpi.label}>
          <CardContent className="p-4 flex items-center gap-3">
            <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
            <div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className="text-xs text-muted-foreground">{kpi.label}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
