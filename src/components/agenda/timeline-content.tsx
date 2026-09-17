import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { consultarTimeline } from "@/lib/seu-instalador.functions";
import { NovoAgendamentoDialog } from "./novo-agendamento-dialog";
import { OsHistoricoDialog } from "./os-historico-dialog";
import { asList, errorMessage, formatTime, pick, shiftDate, todayISO } from "./shared";

export function TimelineContent() {
  const fetchTimeline = useServerFn(consultarTimeline);
  const [date, setDate] = useState(todayISO());
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<{ orderId?: string; clientId?: string; title?: string } | null>(null);

  const query = useQuery({
    queryKey: ["si-timeline", date],
    queryFn: () => fetchTimeline({ data: { date } }),
  });

  const rows = useMemo(() => asList(query.data), [query.data]);

  const byTechnician = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const r of rows) {
      const tech = pick(r, ["technicianName", "technician"], "Sem técnico");
      if (!map.has(tech)) map.set(tech, []);
      map.get(tech)!.push(r);
    }
    for (const list of map.values()) {
      list.sort((a, b) => String(a.scheduledAt ?? "").localeCompare(String(b.scheduledAt ?? "")));
    }
    return Array.from(map.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Agenda — Timeline</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => setDate((d) => shiftDate(d, -1))} aria-label="Dia anterior">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Input type="date" className="w-[150px]" value={date} onChange={(e) => setDate(e.target.value)} />
          <Button variant="outline" size="icon" onClick={() => setDate((d) => shiftDate(d, 1))} aria-label="Próximo dia">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={() => query.refetch()} disabled={query.isFetching}>
            <RefreshCw className={`h-4 w-4 mr-2 ${query.isFetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <CalendarPlus className="h-4 w-4 mr-2" /> Novo agendamento
          </Button>
        </div>
      </div>

      {query.isLoading ? (
        <Card>
          <CardContent className="p-6 flex items-center justify-center gap-2">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Carregando a agenda do dia...</p>
          </CardContent>
        </Card>
      ) : query.isError ? (
        <Card>
          <CardContent className="p-6 text-center space-y-2">
            <AlertTriangle className="h-8 w-8 text-destructive mx-auto" />
            <p className="text-sm text-destructive">{errorMessage(query.error)}</p>
            <Button variant="outline" size="sm" onClick={() => query.refetch()}>
              Tentar novamente
            </Button>
          </CardContent>
        </Card>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum agendamento para esta data.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {byTechnician.map(([tech, list]) => (
            <Card key={tech}>
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-sm">{tech}</span>
                  <Badge variant="secondary">{list.length}</Badge>
                </div>
                <ul className="space-y-2">
                  {list.map((r: any, i: number) => (
                    <li
                      key={r.id ?? i}
                      className="rounded-md border border-border p-2 cursor-pointer hover:border-primary/50"
                      onClick={() =>
                        setDetail({
                          orderId: r.orderId ?? r.id,
                          clientId: r.clientId ?? r.client?.id,
                          title: pick(r, ["clientName", "client"], "Agendamento"),
                        })
                      }
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium truncate">
                          {pick(r, ["clientName", "client", "title"], "Agendamento")}
                        </span>
                        <span className="text-xs text-muted-foreground">{formatTime(r.scheduledAt ?? r.startAt)}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {pick(r, ["serviceTypeName", "serviceType", "description"], "—")}
                        {r.identifier ? ` · ${r.identifier}` : ""}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <NovoAgendamentoDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => query.refetch()} />
      <OsHistoricoDialog
        open={!!detail}
        onClose={() => setDetail(null)}
        orderId={detail?.orderId ?? null}
        clientId={detail?.clientId ?? null}
        title={detail?.title}
      />
    </div>
  );
}
