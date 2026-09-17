import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AlertTriangle, CalendarPlus, ChevronLeft, ChevronRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { consultarTimeline, listarTecnicos } from "@/lib/seu-instalador.functions";
import { NovoAgendamentoDialog } from "./novo-agendamento-dialog";
import { OsDetalhesDialog } from "./os-detalhes-dialog";
import { asList, errorMessage, formatTime, minutesOfDaySP, pick, shiftDate, todayISO } from "./shared";

const START_HOUR = 7;
const END_HOUR = 20;
const HOURS = Array.from({ length: END_HOUR - START_HOUR + 1 }, (_, i) => START_HOUR + i);
const TOTAL_MIN = (END_HOUR - START_HOUR + 1) * 60;
const HOUR_WIDTH = 92; // px
const TECH_COL = 200; // px

const STATUS_STYLES: { key: string; label: string; bg: string; match: string[] }[] = [
  { key: "open", label: "Em aberto", bg: "bg-status-open", match: ["aberto", "open", "pendente"] },
  { key: "scheduled", label: "Agendado", bg: "bg-status-scheduled", match: ["agendad", "scheduled"] },
  { key: "moving", label: "Em deslocamento", bg: "bg-status-moving", match: ["desloc", "moving", "a caminho"] },
  { key: "running", label: "Em execução", bg: "bg-status-running", match: ["execu", "running", "andamento"] },
  { key: "done", label: "Concluído", bg: "bg-status-done", match: ["conclu", "done", "finaliz"] },
  { key: "unproductive", label: "Improdutiva", bg: "bg-status-unproductive", match: ["improdut", "unproductive"] },
  { key: "canceled", label: "Cancelada", bg: "bg-status-canceled", match: ["cancel"] },
];

function statusStyle(status: string) {
  const s = (status || "").toLowerCase();
  return STATUS_STYLES.find((st) => st.match.some((m) => s.includes(m))) ?? STATUS_STYLES[1];
}

function minutesOfDay(value?: string | null): number | null {
  if (!value) return null;
  const raw = String(value);
  // Apenas hora solta ("09:00") já vem no fuso local.
  const onlyTime = raw.match(/^(\d{2}):(\d{2})$/);
  if (onlyTime) return Number(onlyTime[1]) * 60 + Number(onlyTime[2]);
  return minutesOfDaySP(raw);
}

export function TimelineContent() {
  const fetchTimeline = useServerFn(consultarTimeline);
  const fetchTecnicos = useServerFn(listarTecnicos);
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("gestor");
  const [date, setDate] = useState(todayISO());
  const [createOpen, setCreateOpen] = useState(false);
  const [detail, setDetail] = useState<any | null>(null);

  const query = useQuery({
    queryKey: ["si-timeline", date],
    queryFn: () => fetchTimeline({ data: { date } }),
  });

  const techQuery = useQuery({
    queryKey: ["si-technicians-all"],
    queryFn: () => fetchTecnicos({ data: {} }),
  });

  const rows = useMemo(() => asList(query.data), [query.data]);

  const technicians = useMemo(() => {
    const names = new Set<string>();
    for (const t of asList(techQuery.data)) {
      const n = pick(t, ["name", "nome", "technicianName"], "");
      if (n) names.add(n);
    }
    for (const r of rows) names.add(pick(r, ["technicianName", "technician"], "Sem técnico"));
    return Array.from(names).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [techQuery.data, rows]);

  const byTechnician = useMemo(() => {
    const map = new Map<string, any[]>();
    for (const name of technicians) map.set(name, []);
    for (const r of rows) {
      const tech = pick(r, ["technicianName", "technician"], "Sem técnico");
      if (!map.has(tech)) map.set(tech, []);
      const entries = map.get(tech);
      if (entries) entries.push(r);
    }
    return Array.from(map.entries());
  }, [rows, technicians]);

  const gridWidth = TECH_COL + HOURS.length * HOUR_WIDTH;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="text-2xl font-bold text-foreground">Timeline de Atendimentos</h1>
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
            <CalendarPlus className="h-4 w-4 mr-2" /> Nova OS
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Legenda:</span>
          {STATUS_STYLES.map((s) => (
            <span key={s.key} className="flex items-center gap-1.5">
              <span className={`h-2.5 w-2.5 rounded-full ${s.bg}`} />
              {s.label}
            </span>
          ))}
        </CardContent>
      </Card>

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
      ) : byTechnician.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nenhum agendamento para esta data.
          </CardContent>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <div style={{ minWidth: gridWidth }}>
                {/* Cabeçalho de horários */}
                <div className="flex border-b border-border bg-muted/40 sticky top-0 z-10">
                  <div
                    className="shrink-0 px-3 py-2 text-xs font-semibold text-foreground border-r border-border"
                    style={{ width: TECH_COL }}
                  >
                    Técnico
                  </div>
                  {HOURS.map((h) => (
                    <div
                      key={h}
                      className="shrink-0 px-2 py-2 text-xs text-muted-foreground border-r border-border"
                      style={{ width: HOUR_WIDTH }}
                    >
                      {String(h).padStart(2, "0")}:00
                    </div>
                  ))}
                </div>

                {byTechnician.map(([tech, list]) => (
                  <div key={tech} className="flex border-b border-border last:border-b-0">
                    <div
                      className="shrink-0 flex items-center gap-2 px-3 py-3 border-r border-border"
                      style={{ width: TECH_COL }}
                    >
                      <span className="h-7 w-7 shrink-0 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center">
                        {tech.slice(0, 2).toUpperCase()}
                      </span>
                      <span className="text-sm truncate" title={tech}>
                        {tech}
                      </span>
                    </div>

                    <div className="relative" style={{ width: HOURS.length * HOUR_WIDTH, minHeight: 56 }}>
                      {/* grade */}
                      <div className="absolute inset-0 flex pointer-events-none">
                        {HOURS.map((h) => (
                          <div key={h} className="shrink-0 border-r border-border/60" style={{ width: HOUR_WIDTH }} />
                        ))}
                      </div>

                      {list.map((r: any, i: number) => {
                        const when = r.scheduledAt ?? r.startAt ?? r.scheduledTime;
                        const start = minutesOfDay(when);
                        if (start === null) return null;
                        const duration = Number(r.durationMinutes ?? r.duration ?? 60) || 60;
                        const offset = Math.max(0, start - START_HOUR * 60);
                        const left = (offset / TOTAL_MIN) * (HOURS.length * HOUR_WIDTH);
                        const width = Math.max(56, (Math.min(duration, TOTAL_MIN - offset) / TOTAL_MIN) * (HOURS.length * HOUR_WIDTH));
                        const st = statusStyle(pick(r, ["statusName", "status"], ""));
                        const title = pick(r, ["serviceTypeName", "serviceType", "title"], "Atendimento");
                        const client = pick(r, ["clientName", "client"], "");
                        const hour = formatTime(when);
                        return (
                          <button
                            key={r.id ?? i}
                            type="button"
                            className={`absolute top-2 h-10 rounded-md px-2 py-1 text-left text-status-foreground overflow-hidden hover:opacity-90 transition-opacity ${st.bg}`}
                            style={{ left, width }}
                            title={`${hour} · ${title}${client ? ` · ${client}` : ""}`}
                            onClick={() => setDetail(r)}
                          >
                            <span className="block text-[11px] font-semibold leading-tight truncate">
                              {hour} {title}
                            </span>
                            <span className="block text-[10px] leading-tight truncate opacity-90">{client || "—"}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <NovoAgendamentoDialog open={createOpen} onClose={() => setCreateOpen(false)} onCreated={() => query.refetch()} />
      <OsDetalhesDialog
        open={!!detail}
        onClose={() => setDetail(null)}
        activity={detail}
        canEdit={canEdit}
        onUpdated={() => query.refetch()}
      />
    </div>
  );
}
