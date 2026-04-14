import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ptBR } from "date-fns/locale";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

interface TicketCalendarViewProps {
  tickets: any[];
  onSelect: (ticket: any) => void;
}

export function TicketCalendarView({ tickets, onSelect }: TicketCalendarViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  const ticketsByDate = useMemo(() => {
    const map: Record<string, any[]> = {};
    for (const t of tickets) {
      if (t.created_at) {
        const key = format(new Date(t.created_at), "yyyy-MM-dd");
        if (!map[key]) map[key] = [];
        map[key].push(t);
      }
    }
    return map;
  }, [tickets]);

  const datesWithTickets = useMemo(() => {
    return Object.keys(ticketsByDate).map((d) => new Date(d));
  }, [ticketsByDate]);

  const selectedKey = selectedDate ? format(selectedDate, "yyyy-MM-dd") : "";
  const selectedTickets = selectedKey ? ticketsByDate[selectedKey] || [] : [];

  function getStatusColor(status: string) {
    if (status === "finalizado") return "bg-emerald-500";
    if (status === "em_andamento") return "bg-blue-500";
    if (status === "reaberto") return "bg-orange-500";
    return "bg-amber-500";
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-4">
      <Card>
        <CardContent className="p-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ptBR}
            className={cn("pointer-events-auto")}
            modifiers={{ hasTickets: datesWithTickets }}
            modifiersClassNames={{ hasTickets: "bg-primary/20 font-bold" }}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground">
          {selectedDate ? format(selectedDate, "dd/MM/yyyy") : "Selecione uma data"} — {selectedTickets.length} ticket(s)
        </h3>
        {selectedTickets.length === 0 ? (
          <Card>
            <CardContent className="p-4 text-sm text-muted-foreground text-center">
              Nenhum ticket nesta data.
            </CardContent>
          </Card>
        ) : (
          selectedTickets.map((t: any) => (
            <Card
              key={t.id}
              className="cursor-pointer hover:bg-accent/50 transition-colors"
              onClick={() => onSelect(t)}
            >
              <CardContent className="p-3 flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${getStatusColor(t.status)}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {t.contact_name || t.attendance_id || "Ticket"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.companies?.name || ""} {t.sector ? `• ${t.sector}` : ""}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">{t.status}</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
