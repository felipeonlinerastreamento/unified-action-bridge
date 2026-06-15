import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line,
} from "recharts";
import { ReportKpiCard } from "@/components/relatorios/report-kpi-card";
import { exportToCSV } from "@/components/relatorios/export-utils";
import { Clock, LogIn, LogOut, Timer, AlertTriangle, Loader2, Download, X } from "lucide-react";


interface Props {
  dateFrom: string;
  dateTo: string;
  operatorFilter?: string;
}

function fmtHm(minutes: number) {
  if (!minutes || minutes < 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    day: "2-digit", month: "2-digit", year: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

export function JourneyIdleTab({ dateFrom, dateTo, operatorFilter }: Props) {
  const [threshold, setThreshold] = useState(10);
  const [thresholdInput, setThresholdInput] = useState("10");
  const [localOperator, setLocalOperator] = useState<string>("__all__");
  const [contactSearch, setContactSearch] = useState("");
  const [dayFilter, setDayFilter] = useState<string>("__all__");


  const fromIso = `${dateFrom}T00:00:00`;
  const toIso = `${dateTo}T23:59:59`;

  // Operators list
  const { data: operators = [] } = useQuery({
    queryKey: ["journey-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({
        id: p.user_id as string,
        name: (p.name as string) || "Sem nome",
      }));
    },
  });

  const opName = useMemo(() => {
    const m: Record<string, string> = {};
    operators.forEach((o) => { m[o.id] = o.name; });
    return m;
  }, [operators]);

  // Presence audit logs
  const { data: presence = [], isLoading: presenceLoading } = useQuery({
    queryKey: ["journey-presence", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      let q = supabase
        .from("audit_logs")
        .select("user_id, user_name, event_type, created_at")
        .eq("event_category", "presence")
        .in("event_type", ["set_online", "set_offline"])
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: true });
      if (operatorFilter) q = q.eq("user_id", operatorFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Array<{
        user_id: string; user_name: string | null;
        event_type: string; created_at: string;
      }>;
    },
  });

  // Journey rows: per (user, day)
  type JourneyRow = {
    userId: string; userName: string; day: string;
    firstOnline: string | null; lastOffline: string | null;
    totalMinutes: number; pauses: number; stillOnline: boolean;
  };
  const journeyRows = useMemo<JourneyRow[]>(() => {
    // Group events per (user, day)
    const groups: Record<string, { userId: string; userName: string; day: string; events: typeof presence }> = {};
    presence.forEach((ev) => {
      const day = ev.created_at.slice(0, 10);
      const key = `${ev.user_id}::${day}`;
      if (!groups[key]) {
        groups[key] = {
          userId: ev.user_id,
          userName: ev.user_name || opName[ev.user_id] || "—",
          day, events: [],
        };
      }
      groups[key].events.push(ev);
    });
    const out: JourneyRow[] = [];
    Object.values(groups).forEach((g) => {
      const evs = g.events.slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      let firstOnline: string | null = null;
      let lastOffline: string | null = null;
      let total = 0;
      let pauses = 0;
      let openOnline: string | null = null;
      const dayEndIso = `${g.day}T23:59:59`;
      const dayEnd = new Date(dayEndIso).getTime();
      const nowMs = Date.now();
      evs.forEach((ev) => {
        if (ev.event_type === "set_online") {
          if (!firstOnline) firstOnline = ev.created_at;
          if (!openOnline) openOnline = ev.created_at;
        } else if (ev.event_type === "set_offline") {
          lastOffline = ev.created_at;
          if (openOnline) {
            total += (new Date(ev.created_at).getTime() - new Date(openOnline).getTime()) / 60000;
            openOnline = null;
            pauses++;
          }
        }
      });
      let stillOnline = false;
      if (openOnline) {
        // Cap at day end or now (whichever is earlier)
        const cap = Math.min(dayEnd, nowMs);
        total += Math.max(0, (cap - new Date(openOnline).getTime()) / 60000);
        stillOnline = true;
      }
      out.push({
        userId: g.userId, userName: g.userName, day: g.day,
        firstOnline, lastOffline, totalMinutes: total,
        pauses, stillOnline,
      });
    });
    return out.sort((a, b) =>
      b.day.localeCompare(a.day) || a.userName.localeCompare(b.userName)
    );
  }, [presence, opName]);

  // ============ IDLENESS ============
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["journey-chats", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      let q = supabase
        .from("zapi_chats")
        .select("id, phone, contact_name, assigned_to, status, created_at, closed_at, last_message_at")
        .not("assigned_to", "is", null)
        .or(`closed_at.gte.${fromIso},closed_at.is.null`)
        .lte("created_at", toIso);
      if (operatorFilter) q = q.eq("assigned_to", operatorFilter);
      const { data, error } = await q.limit(2000);
      if (error) throw error;
      return (data || []) as Array<{
        id: string; phone: string; contact_name: string | null;
        assigned_to: string; status: string;
        created_at: string; closed_at: string | null;
        last_message_at: string | null;
      }>;
    },
  });

  const { data: opMessages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["journey-op-messages", fromIso, toIso, chats.map((c) => c.id).join(",")],
    enabled: chats.length > 0,
    queryFn: async () => {
      const chatIds = chats.map((c) => c.id);
      // Paginate by 200 chats per request
      const all: Array<{ chat_id: string; created_at: string; sent_by_user_id: string | null; from_me: boolean }> = [];
      const chunk = 200;
      for (let i = 0; i < chatIds.length; i += chunk) {
        const slice = chatIds.slice(i, i + chunk);
        const { data, error } = await supabase
          .from("zapi_messages")
          .select("chat_id, created_at, sent_by_user_id, from_me")
          .in("chat_id", slice)
          .eq("from_me", true)
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true })
          .limit(10000);
        if (error) throw error;
        all.push(...((data || []) as any));
      }
      return all;
    },
  });

  type Gap = {
    chatId: string; userId: string; userName: string;
    contact: string; phone: string;
    start: string; end: string; minutes: number;
  };
  const gaps = useMemo<Gap[]>(() => {
    const chatById: Record<string, typeof chats[number]> = {};
    chats.forEach((c) => { chatById[c.id] = c; });
    const byChat: Record<string, typeof opMessages> = {};
    opMessages.forEach((m) => {
      (byChat[m.chat_id] ||= []).push(m);
    });
    const out: Gap[] = [];
    chats.forEach((c) => {
      const userId = c.assigned_to;
      if (!userId) return;
      const userName = opName[userId] || "—";
      const msgs = (byChat[c.id] || []).slice().sort((a, b) => a.created_at.localeCompare(b.created_at));
      // Anchor start = chat created_at clamped to window
      const windowStart = new Date(fromIso).getTime();
      const windowEnd = new Date(toIso).getTime();
      const chatStart = Math.max(windowStart, new Date(c.created_at).getTime());
      const chatEnd = c.closed_at
        ? Math.min(windowEnd, new Date(c.closed_at).getTime())
        : Math.min(windowEnd, Date.now());
      if (chatEnd <= chatStart) return;

      const points: number[] = [chatStart, ...msgs.map((m) => new Date(m.created_at).getTime()), chatEnd];
      for (let i = 0; i < points.length - 1; i++) {
        const a = points[i], b = points[i + 1];
        const mins = (b - a) / 60000;
        if (mins > threshold) {
          out.push({
            chatId: c.id, userId, userName,
            contact: c.contact_name || c.phone,
            phone: c.phone,
            start: new Date(a).toISOString(),
            end: new Date(b).toISOString(),
            minutes: mins,
          });
        }
      }
    });
    return out.sort((a, b) => b.minutes - a.minutes);
  }, [chats, opMessages, opName, threshold, fromIso, toIso]);

  // Aggregates for charts
  const idleByOperator = useMemo(() => {
    const m: Record<string, { name: string; minutes: number; count: number }> = {};
    gaps.forEach((g) => {
      if (!m[g.userId]) m[g.userId] = { name: g.userName, minutes: 0, count: 0 };
      m[g.userId].minutes += g.minutes;
      m[g.userId].count += 1;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => b.minutes - a.minutes);
  }, [gaps]);

  const idleByDay = useMemo(() => {
    const m: Record<string, { date: string; minutes: number }> = {};
    gaps.forEach((g) => {
      const day = g.start.slice(0, 10);
      if (!m[day]) m[day] = { date: day, minutes: 0 };
      m[day].minutes += g.minutes;
    });
    return Object.values(m)
      .map((v) => ({ ...v, minutes: Math.round(v.minutes) }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [gaps]);

  const totalIdleMinutes = useMemo(
    () => gaps.reduce((s, g) => s + g.minutes, 0), [gaps]
  );

  const applyThreshold = () => {
    const n = Math.max(1, parseInt(thresholdInput, 10) || 10);
    setThreshold(n);
    setThresholdInput(String(n));
  };

  const exportJourney = () => {
    exportToCSV(
      journeyRows.map((r) => ({
        Operador: r.userName,
        Data: r.day,
        Inicio: fmtTime(r.firstOnline),
        Fim: r.stillOnline ? "Em atividade" : fmtTime(r.lastOffline),
        TempoOnline: fmtHm(r.totalMinutes),
        Pausas: r.pauses,
      })),
      `jornada-operadores-${dateFrom}_${dateTo}`
    );
  };

  const exportIdle = () => {
    exportToCSV(
      gaps.map((g) => ({
        Operador: g.userName,
        Contato: g.contact,
        Telefone: g.phone,
        InicioGap: fmtDateTime(g.start),
        FimGap: fmtDateTime(g.end),
        Duracao: fmtHm(g.minutes),
        ChatId: g.chatId,
      })),
      `ociosidade-chats-${threshold}min-${dateFrom}_${dateTo}`
    );
  };

  const loading = presenceLoading || chatsLoading || msgsLoading;

  const cfgBar: ChartConfig = { minutes: { label: "Minutos ociosos", color: "hsl(var(--chart-4))" } };
  const cfgLine: ChartConfig = { minutes: { label: "Minutos ociosos", color: "hsl(var(--chart-2))" } };

  return (
    <div className="space-y-6">
      {/* ============ JORNADA ============ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4" /> Jornada do Dia (Online / Offline)
          </h3>
          <Button size="sm" variant="outline" onClick={exportJourney} disabled={journeyRows.length === 0}>
            <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
          </Button>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <ReportKpiCard
            title="Operadores ativos"
            value={new Set(journeyRows.map((r) => r.userId)).size}
            icon={LogIn}
            subtitle={`${dateFrom} a ${dateTo}`}
          />
          <ReportKpiCard
            title="Dias com atividade"
            value={journeyRows.length}
            icon={Timer}
          />
          <ReportKpiCard
            title="Tempo online total"
            value={fmtHm(journeyRows.reduce((s, r) => s + r.totalMinutes, 0))}
            icon={Clock}
          />
          <ReportKpiCard
            title="Ainda online"
            value={journeyRows.filter((r) => r.stillOnline).length}
            icon={LogOut}
          />
        </div>

        <Card>
          <CardContent className="pt-4">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : journeyRows.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum registro de presença no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead>Tempo Online</TableHead>
                      <TableHead className="text-right">Pausas</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {journeyRows.map((r) => (
                      <TableRow key={`${r.userId}-${r.day}`}>
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell>{new Date(r.day).toLocaleDateString("pt-BR")}</TableCell>
                        <TableCell>{fmtTime(r.firstOnline)}</TableCell>
                        <TableCell>
                          {r.stillOnline ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                              Em atividade
                            </Badge>
                          ) : fmtTime(r.lastOffline)}
                        </TableCell>
                        <TableCell>{fmtHm(r.totalMinutes)}</TableCell>
                        <TableCell className="text-right">{r.pauses}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ============ OCIOSIDADE ============ */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Chats Ociosos (sem mensagem do operador)
          </h3>
          <div className="flex items-end gap-2">
            <div>
              <Label htmlFor="threshold" className="text-xs">Limite (min)</Label>
              <Input
                id="threshold" type="number" min={1} className="h-8 w-24"
                value={thresholdInput}
                onChange={(e) => setThresholdInput(e.target.value)}
                onBlur={applyThreshold}
                onKeyDown={(e) => { if (e.key === "Enter") applyThreshold(); }}
              />
            </div>
            <Button size="sm" variant="outline" onClick={exportIdle} disabled={gaps.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
            </Button>
          </div>
        </div>

        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          <ReportKpiCard
            title={`Ocorrências (> ${threshold}min)`}
            value={gaps.length}
            icon={AlertTriangle}
          />
          <ReportKpiCard
            title="Tempo ocioso total"
            value={fmtHm(totalIdleMinutes)}
            icon={Timer}
          />
          <ReportKpiCard
            title="Operadores impactados"
            value={idleByOperator.length}
            icon={LogIn}
          />
          <ReportKpiCard
            title="Chats com ociosidade"
            value={new Set(gaps.map((g) => g.chatId)).size}
            icon={Clock}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ociosidade por Operador (min)</CardTitle>
            </CardHeader>
            <CardContent>
              {idleByOperator.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
              ) : (
                <ChartContainer config={cfgBar} className="h-[280px] w-full">
                  <BarChart data={idleByOperator}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Ociosidade por Dia (min)</CardTitle>
            </CardHeader>
            <CardContent>
              {idleByDay.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Sem dados</p>
              ) : (
                <ChartContainer config={cfgLine} className="h-[280px] w-full">
                  <LineChart data={idleByDay}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="minutes" stroke="var(--color-minutes)" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ChartContainer>
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Detalhamento das Ocorrências</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum período de ociosidade acima de {threshold} min no período.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Início</TableHead>
                      <TableHead>Fim</TableHead>
                      <TableHead className="text-right">Duração</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {gaps.slice(0, 200).map((g, i) => (
                      <TableRow key={`${g.chatId}-${i}`}>
                        <TableCell className="font-medium">{g.userName}</TableCell>
                        <TableCell>
                          <div className="flex flex-col">
                            <span>{g.contact}</span>
                            <span className="text-xs text-muted-foreground">{g.phone}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs">{fmtDateTime(g.start)}</TableCell>
                        <TableCell className="text-xs">{fmtDateTime(g.end)}</TableCell>
                        <TableCell className="text-right font-medium">{fmtHm(g.minutes)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {gaps.length > 200 && (
                  <p className="text-xs text-muted-foreground text-center pt-2">
                    Exibindo 200 de {gaps.length} ocorrências. Exporte o CSV para ver todas.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
