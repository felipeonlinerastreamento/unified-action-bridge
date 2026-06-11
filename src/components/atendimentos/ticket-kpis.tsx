import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Clock, CheckCircle, RotateCcw } from "lucide-react";

interface TicketKpisProps {
  tickets: any[];
  onStatusClick?: (status: "abertos_em_andamento" | "aberto" | "em_andamento" | "finalizado" | "reaberto") => void;
  activeStatus?: string;
}

export function TicketKpis({ tickets, onStatusClick, activeStatus }: TicketKpisProps) {
  const abertos = tickets.filter((t) => t.status === "aberto" || t.status === "reaberto").length;
  const emAndamento = tickets.filter((t) => t.status === "em_andamento").length;
  const today = new Date().toDateString();
  const finalizadosHoje = tickets.filter(
    (t) => t.status === "finalizado" && t.closed_at && new Date(t.closed_at).toDateString() === today
  ).length;
  const reabertos = tickets.filter((t) => t.status === "reaberto").length;

  const kpis = [
    { label: "Abertos", value: abertos, icon: AlertCircle, color: "text-amber-500", status: "aberto" as const },
    { label: "Em Andamento", value: emAndamento, icon: Clock, color: "text-blue-500", status: "em_andamento" as const },
    { label: "Finalizados Hoje", value: finalizadosHoje, icon: CheckCircle, color: "text-emerald-500", status: "finalizado" as const },
    { label: "Reabertos", value: reabertos, icon: RotateCcw, color: "text-orange-500", status: "reaberto" as const },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {kpis.map((kpi) => {
        const isActive = activeStatus === kpi.status;
        const clickable = !!onStatusClick;
        return (
          <Card
            key={kpi.label}
            onClick={clickable ? () => onStatusClick!(kpi.status) : undefined}
            role={clickable ? "button" : undefined}
            tabIndex={clickable ? 0 : undefined}
            onKeyDown={
              clickable
                ? (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      onStatusClick!(kpi.status);
                    }
                  }
                : undefined
            }
            className={
              clickable
                ? `cursor-pointer transition-colors hover:bg-accent/50 ${isActive ? "ring-2 ring-primary" : ""}`
                : ""
            }
            title={clickable ? `Filtrar por ${kpi.label}` : undefined}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <kpi.icon className={`h-8 w-8 ${kpi.color}`} />
              <div>
                <p className="text-2xl font-bold">{kpi.value}</p>
                <p className="text-xs text-muted-foreground">{kpi.label}</p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
