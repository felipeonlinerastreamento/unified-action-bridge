import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ReportKpiCard } from "@/components/relatorios/report-kpi-card";
import { exportToCSV } from "@/components/relatorios/export-utils";
import { Loader2, LogIn, LogOut, Timer, Download, Users } from "lucide-react";

interface Props {
  dateFrom: string;
  dateTo: string;
  operatorFilter?: string;
}

interface SessionRow {
  id: string;
  user_id: string;
  started_at: string;
  last_ping_at: string;
  ended_at: string | null;
}

function fmtHm(minutes: number) {
  if (!minutes || minutes < 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h === 0 ? `${m}min` : `${h}h ${m}min`;
}

function fmtTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit" });
}

const chartConfig: ChartConfig = {
  minutos: { label: "Minutos online", color: "hsl(var(--chart-1))" },
};

export function PresenceSessionsTab({ dateFrom, dateTo, operatorFilter }: Props) {
  const [localOperator, setLocalOperator] = useState<string>("__all__");

  const { data: profiles = [] } = useQuery({
    queryKey: ["presence-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
  });

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    (profiles as any[]).forEach((p) => { m[p.user_id] = p.name || "(sem nome)"; });
    return m;
  }, [profiles]);

  const { data: sessions = [], isLoading } = useQuery<SessionRow[]>({
    queryKey: ["presence-sessions", dateFrom, dateTo],
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_presence_sessions")
        .select("id, user_id, started_at, last_ping_at, ended_at")
        .gte("started_at", `${dateFrom}T00:00:00`)
        .lte("started_at", `${dateTo}T23:59:59`)
        .order("started_at", { ascending: false })
        .limit(5000);
      return (data as SessionRow[]) || [];
    },
  });

  const effectiveOperator = localOperator !== "__all__" ? localOperator : (operatorFilter || "");

  const filtered = useMemo(
    () => sessions.filter((s) => !effectiveOperator || s.user_id === effectiveOperator),
    [sessions, effectiveOperator],
  );

  const rows = useMemo(() => {
    return filtered.map((s) => {
      const end = s.ended_at || s.last_ping_at;
      const minutes = Math.max(0, (new Date(end).getTime() - new Date(s.started_at).getTime()) / 60000);
      return {
        ...s,
        operator: nameById[s.user_id] || s.user_id.slice(0, 8),
        endedEffective: end,
        open: !s.ended_at,
        minutes,
      };
    });
  }, [filtered, nameById]);

  const byOperator = useMemo(() => {
    const map: Record<string, { operator: string; minutos: number; sessoes: number }> = {};
    rows.forEach((r) => {
      if (!map[r.user_id]) map[r.user_id] = { operator: r.operator, minutos: 0, sessoes: 0 };
      map[r.user_id].minutos += r.minutes;
      map[r.user_id].sessoes += 1;
    });
    return Object.values(map)
      .map((v) => ({ ...v, minutos: Math.round(v.minutos) }))
      .sort((a, b) => b.minutos - a.minutos);
  }, [rows]);

  const totalMinutes = rows.reduce((acc, r) => acc + r.minutes, 0);
  const openNow = rows.filter((r) => r.open).length;

  const handleExport = () => {
    exportToCSV(
      rows.map((r) => ({
        Operador: r.operator,
        Data: fmtDate(r.started_at),
        Online: fmtTime(r.started_at),
        Offline: r.open ? "Em andamento" : fmtTime(r.endedEffective),
        Duração: fmtHm(r.minutes),
      })),
      `sessoes-presenca-${dateFrom}-a-${dateTo}`,
    );
  };

  if (isLoading) {
    return (
      <div className="py-12 flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando sessões...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <div className="text-xs text-muted-foreground mb-1">Operador</div>
          <Select value={localOperator} onValueChange={setLocalOperator}>
            <SelectTrigger className="w-[220px] h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">Todos os operadores</SelectItem>
              {(profiles as any[]).map((p) => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.name || "(sem nome)"}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" /> Exportar CSV
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <ReportKpiCard title="Sessões no período" value={String(rows.length)} icon={LogIn} />
        <ReportKpiCard title="Tempo online total" value={fmtHm(totalMinutes)} icon={Timer} />
        <ReportKpiCard
          title="Média por sessão"
          value={fmtHm(rows.length ? totalMinutes / rows.length : 0)}
          icon={LogOut}
        />
        <ReportKpiCard title="Sessões abertas agora" value={String(openNow)} icon={Users} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Tempo online por operador</CardTitle>
        </CardHeader>
        <CardContent>
          {byOperator.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">Sem dados no período.</p>
          ) : (
            <ChartContainer config={chartConfig} className="h-[280px] w-full">
              <BarChart data={byOperator}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="operator" tick={{ fontSize: 11 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="minutos" fill="var(--color-minutos)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Histórico de sessões (online → offline)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">Nenhuma sessão registrada no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Operador</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Ficou online</TableHead>
                  <TableHead>Ficou offline</TableHead>
                  <TableHead className="text-right">Duração</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.slice(0, 500).map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm font-medium">{r.operator}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{fmtDate(r.started_at)}</TableCell>
                    <TableCell className="text-xs">{fmtTime(r.started_at)}</TableCell>
                    <TableCell className="text-xs">
                      {r.open ? (
                        <Badge variant="secondary" className="text-[10px]">Em andamento</Badge>
                      ) : (
                        fmtTime(r.endedEffective)
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-right">{fmtHm(r.minutes)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
