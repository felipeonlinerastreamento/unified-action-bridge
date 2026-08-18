import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "./report-kpi-card";
import { ChartFrame } from "./chart-frame";
import { formatTicketProtocol } from "@/lib/protocol-format";
import {
  Loader2, Ticket as TicketIcon, CheckCircle2, Clock, RotateCcw, Users, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";

interface Props {
  dateFrom: string;
  dateTo: string;
}

const COLORS = [
  "hsl(var(--primary))", "#22c55e", "#f59e0b", "#ef4444", "#6366f1",
  "#14b8a6", "#ec4899", "#8b5cf6", "#0ea5e9", "#84cc16",
];

const OPEN_STATUSES = ["aberto", "em_andamento", "reaberto"];

function hoursBetween(a?: string | null, b?: string | null) {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  if (!isFinite(diff) || diff < 0) return null;
  return diff / 3_600_000;
}

function fmtHours(h: number | null) {
  if (h === null || !isFinite(h)) return "—";
  if (h < 1) return `${Math.round(h * 60)}min`;
  if (h < 48) return `${h.toFixed(1)}h`;
  return `${(h / 24).toFixed(1)}d`;
}

export function TicketsReportTab({ dateFrom, dateTo }: Props) {
  const [category, setCategory] = useState("todos");
  const [sector, setSector] = useState("todos");
  const [status, setStatus] = useState("todos");
  const [priority, setPriority] = useState("todos");
  const [operator, setOperator] = useState("todos");
  const [search, setSearch] = useState("");

  const { data: profiles = [] } = useQuery({
    queryKey: ["report-tickets-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("user_id, name");
      if (error) throw error;
      return data || [];
    },
    staleTime: 5 * 60_000,
  });

  const nameOf = useMemo(() => {
    const m = new Map<string, string>();
    profiles.forEach((p: any) => m.set(p.user_id, p.name || p.user_id));
    return (id?: string | null) => (id ? m.get(id) || "—" : "—");
  }, [profiles]);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["report-tickets", dateFrom, dateTo],
    queryFn: async () => {
      const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toIso = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("service_tickets")
        .select("id, attendance_id, protocol_number, category, subcategory_name, sector, status, priority, contact_name, assigned_to, closed_by, opened_by, created_at, closed_at, reopened_at, companies:company_id(name)")
        .or(`and(created_at.gte.${fromIso},created_at.lte.${toIso}),and(closed_at.gte.${fromIso},closed_at.lte.${toIso})`)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const categories = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.category).filter(Boolean))).sort() as string[],
    [tickets],
  );
  const sectors = useMemo(
    () => Array.from(new Set(tickets.map((t) => t.sector).filter(Boolean))).sort() as string[],
    [tickets],
  );
  const operators = useMemo(() => {
    const ids = new Set<string>();
    tickets.forEach((t) => { if (t.assigned_to) ids.add(t.assigned_to); if (t.closed_by) ids.add(t.closed_by); });
    return Array.from(ids).map((id) => ({ id, name: nameOf(id) })).sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  }, [tickets, nameOf]);

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (category !== "todos" && t.category !== category) return false;
      if (sector !== "todos" && t.sector !== sector) return false;
      if (priority !== "todos" && (t.priority || "media") !== priority) return false;
      if (status === "abertos" ? !OPEN_STATUSES.includes(t.status) : status !== "todos" && t.status !== status) return false;
      if (operator !== "todos" && t.assigned_to !== operator && t.closed_by !== operator) return false;
      if (term) {
        const hay = [
          formatTicketProtocol(t.protocol_number ?? t.attendance_id) || "",
          String(t.protocol_number ?? ""),
          t.contact_name, t.companies?.name, t.category, t.subcategory_name, t.sector,
        ].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [tickets, category, sector, status, priority, operator, search]);

  const kpis = useMemo(() => {
    const total = rows.length;
    const finished = rows.filter((t) => t.status === "finalizado");
    const open = rows.filter((t) => OPEN_STATUSES.includes(t.status));
    const reopened = rows.filter((t) => !!t.reopened_at || t.status === "reaberto");
    const durations = finished
      .map((t) => hoursBetween(t.created_at, t.closed_at))
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);
    const avg = durations.length ? durations.reduce((a, b) => a + b, 0) / durations.length : null;
    const median = durations.length ? durations[Math.floor(durations.length / 2)] : null;
    const now = Date.now();
    const aging = open
      .map((t) => (now - new Date(t.created_at).getTime()) / 3_600_000)
      .sort((a, b) => b - a);
    return {
      total,
      finished: finished.length,
      open: open.length,
      reopened: reopened.length,
      resolutionRate: total ? (finished.length / total) * 100 : 0,
      reopenRate: total ? (reopened.length / total) * 100 : 0,
      avg, median,
      oldestOpen: aging[0] ?? null,
      avgAging: aging.length ? aging.reduce((a, b) => a + b, 0) / aging.length : null,
      over24h: open.filter((t) => (now - new Date(t.created_at).getTime()) / 3_600_000 > 24).length,
    };
  }, [rows]);

  const byCategory = useMemo(() => {
    const map = new Map<string, { name: string; total: number; finalizados: number; abertos: number; horas: number[] }>();
    for (const t of rows) {
      const key = t.category || "Sem categoria";
      const cur = map.get(key) || { name: key, total: 0, finalizados: 0, abertos: 0, horas: [] };
      cur.total++;
      if (t.status === "finalizado") {
        cur.finalizados++;
        const h = hoursBetween(t.created_at, t.closed_at);
        if (h !== null) cur.horas.push(h);
      }
      if (OPEN_STATUSES.includes(t.status)) cur.abertos++;
      map.set(key, cur);
    }
    return Array.from(map.values())
      .map((c) => ({
        ...c,
        tmr: c.horas.length ? c.horas.reduce((a, b) => a + b, 0) / c.horas.length : null,
      }))
      .sort((a, b) => b.total - a.total);
  }, [rows]);

  const bySubcategory = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rows) {
      if (!t.subcategory_name) continue;
      map.set(t.subcategory_name, (map.get(t.subcategory_name) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total).slice(0, 12);
  }, [rows]);

  const bySector = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rows) map.set(t.sector || "Sem setor", (map.get(t.sector || "Sem setor") || 0) + 1);
    return Array.from(map.entries()).map(([name, total]) => ({ name, total })).sort((a, b) => b.total - a.total);
  }, [rows]);

  const byOperator = useMemo(() => {
    const map = new Map<string, { id: string; name: string; atribuidos: number; finalizados: number; abertos: number; horas: number[]; reaberturas: number }>();
    const ensure = (id: string) => {
      const cur = map.get(id) || { id, name: nameOf(id), atribuidos: 0, finalizados: 0, abertos: 0, horas: [], reaberturas: 0 };
      map.set(id, cur);
      return cur;
    };
    for (const t of rows) {
      if (t.assigned_to) {
        const a = ensure(t.assigned_to);
        a.atribuidos++;
        if (OPEN_STATUSES.includes(t.status)) a.abertos++;
        if (t.reopened_at) a.reaberturas++;
      }
      if (t.status === "finalizado" && t.closed_by) {
        const c = ensure(t.closed_by);
        c.finalizados++;
        const h = hoursBetween(t.created_at, t.closed_at);
        if (h !== null) c.horas.push(h);
      }
    }
    return Array.from(map.values())
      .map((o) => ({
        ...o,
        tmr: o.horas.length ? o.horas.reduce((a, b) => a + b, 0) / o.horas.length : null,
        taxa: o.atribuidos ? (o.finalizados / o.atribuidos) * 100 : null,
      }))
      .sort((a, b) => b.finalizados - a.finalizados);
  }, [rows, nameOf]);

  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; criados: number; finalizados: number }>();
    const key = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const ensure = (d: string) => {
      const cur = map.get(d) || { day: d, criados: 0, finalizados: 0 };
      map.set(d, cur);
      return cur;
    };
    for (const t of rows) {
      ensure(key(t.created_at)).criados++;
      if (t.status === "finalizado" && t.closed_at) ensure(key(t.closed_at)).finalizados++;
    }
    return Array.from(map.values()).sort((a, b) => {
      const [da, ma, ya] = a.day.split("/").map(Number);
      const [db, mb, yb] = b.day.split("/").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [rows]);

  const byCompany = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rows) {
      const name = t.companies?.name || t.contact_name || "—";
      map.set(name, (map.get(name) || 0) + 1);
    }
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }))
      .sort((a, b) => b.total - a.total).slice(0, 10);
  }, [rows]);

  const byPriority = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of rows) map.set(t.priority || "media", (map.get(t.priority || "media") || 0) + 1);
    return Array.from(map.entries()).map(([name, total]) => ({ name, total }));
  }, [rows]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando chamados...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div>
            <Label className="text-xs">Categoria</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger className="w-[170px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                {categories.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Setor</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {sectors.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[150px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                <SelectItem value="abertos">Em aberto</SelectItem>
                <SelectItem value="aberto">Aberto</SelectItem>
                <SelectItem value="em_andamento">Em andamento</SelectItem>
                <SelectItem value="reaberto">Reaberto</SelectItem>
                <SelectItem value="finalizado">Finalizado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Prioridade</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger className="w-[130px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todas</SelectItem>
                <SelectItem value="baixa">Baixa</SelectItem>
                <SelectItem value="media">Média</SelectItem>
                <SelectItem value="alta">Alta</SelectItem>
                <SelectItem value="urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Operador</Label>
            <Select value={operator} onValueChange={setOperator}>
              <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {operators.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Protocolo, cliente, categoria..."
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard title="Chamados no período" value={kpis.total} icon={TicketIcon} subtitle={`${dateFrom} a ${dateTo}`} />
        <ReportKpiCard title="Finalizados" value={kpis.finished} icon={CheckCircle2} subtitle={`${kpis.resolutionRate.toFixed(1)}% de resolução`} />
        <ReportKpiCard title="Em aberto" value={kpis.open} icon={Clock} subtitle={`${kpis.over24h} há mais de 24h`} />
        <ReportKpiCard title="Reaberturas" value={kpis.reopened} icon={RotateCcw} subtitle={`${kpis.reopenRate.toFixed(1)}% do total`} />
        <ReportKpiCard title="TMR médio" value={fmtHours(kpis.avg)} icon={Clock} subtitle="Abertura → finalização" />
        <ReportKpiCard title="TMR mediano" value={fmtHours(kpis.median)} icon={Clock} subtitle="Menos sensível a outliers" />
        <ReportKpiCard title="Idade média do backlog" value={fmtHours(kpis.avgAging)} icon={Clock} subtitle="Chamados ainda abertos" />
        <ReportKpiCard title="Mais antigo em aberto" value={fmtHours(kpis.oldestOpen)} icon={Clock} subtitle="Maior tempo sem conclusão" />
      </div>

      {/* Categoria */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Chamados por categoria" data={byCategory.map((c) => ({ Categoria: c.name, Total: c.total, Finalizados: c.finalizados, Abertos: c.abertos, TMR: fmtHours(c.tmr) }))} filename="chamados-por-categoria">
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={byCategory.slice(0, 12)} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={130} tick={{ fontSize: 11 }} />
              <Tooltip />
              <Legend />
              <Bar dataKey="finalizados" name="Finalizados" stackId="a" fill="#22c55e" />
              <Bar dataKey="abertos" name="Em aberto" stackId="a" fill="#f59e0b" />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Distribuição por prioridade" zoomable={false} data={byPriority.map((p) => ({ Prioridade: p.name, Total: p.total }))} filename="chamados-por-prioridade">
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={byPriority} dataKey="total" nameKey="name" outerRadius={100} label>
                {byPriority.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      {/* Evolução */}
      <ChartFrame title="Evolução diária (criados x finalizados)" data={byDay} filename="chamados-evolucao">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="criados" name="Criados" stroke="hsl(var(--primary))" strokeWidth={2} />
            <Line type="monotone" dataKey="finalizados" name="Finalizados" stroke="#22c55e" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* Tabela categorias */}
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-sm">Quantitativo por categoria</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Categoria</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Finalizados</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">% do total</TableHead>
                <TableHead className="text-right">TMR médio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byCategory.map((c) => (
                <TableRow key={c.name}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell className="text-right">{c.total}</TableCell>
                  <TableCell className="text-right">{c.finalizados}</TableCell>
                  <TableCell className="text-right">{c.abertos}</TableCell>
                  <TableCell className="text-right">{kpis.total ? ((c.total / kpis.total) * 100).toFixed(1) : "0"}%</TableCell>
                  <TableCell className="text-right">{fmtHours(c.tmr)}</TableCell>
                </TableRow>
              ))}
              {byCategory.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Resolução por operador */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><Users className="h-4 w-4" /> Resolução por operador</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Operador</TableHead>
                <TableHead className="text-right">Atribuídos</TableHead>
                <TableHead className="text-right">Finalizados</TableHead>
                <TableHead className="text-right">Em aberto</TableHead>
                <TableHead className="text-right">Taxa de resolução</TableHead>
                <TableHead className="text-right">TMR médio</TableHead>
                <TableHead className="text-right">Reaberturas</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {byOperator.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell className="text-right">{o.atribuidos}</TableCell>
                  <TableCell className="text-right">{o.finalizados}</TableCell>
                  <TableCell className="text-right">{o.abertos}</TableCell>
                  <TableCell className="text-right">
                    {o.taxa === null ? "—" : (
                      <Badge variant={o.taxa >= 80 ? "default" : o.taxa >= 50 ? "secondary" : "destructive"}>
                        {o.taxa.toFixed(0)}%
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{fmtHours(o.tmr)}</TableCell>
                  <TableCell className="text-right">{o.reaberturas}</TableCell>
                </TableRow>
              ))}
              {byOperator.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Setor / Subcategoria / Clientes */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Chamados por setor" data={bySector.map((s) => ({ Setor: s.name, Total: s.total }))} filename="chamados-por-setor">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bySector}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip />
              <Bar dataKey="total" name="Chamados" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>

        <ChartFrame title="Top subcategorias" data={bySubcategory.map((s) => ({ Subcategoria: s.name, Total: s.total }))} filename="chamados-por-subcategoria">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={bySubcategory} layout="vertical" margin={{ left: 24 }}>
              <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10 }} />
              <Tooltip />
              <Bar dataKey="total" name="Chamados" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartFrame>
      </div>

      <ChartFrame title="Top 10 clientes por volume de chamados" data={byCompany.map((c) => ({ Cliente: c.name, Total: c.total }))} filename="chamados-por-cliente">
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={byCompany} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="name" width={180} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Bar dataKey="total" name="Chamados" fill="#14b8a6" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* Detalhamento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento ({rows.length} chamados — exibindo até 200)</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Protocolo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Setor</TableHead>
                <TableHead>Responsável</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Abertura</TableHead>
                <TableHead className="text-right">Duração</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 200).map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-mono text-xs">#{formatTicketProtocol(t.protocol_number ?? t.attendance_id)}</TableCell>
                  <TableCell className="text-xs">{t.companies?.name || t.contact_name || "—"}</TableCell>
                  <TableCell className="text-xs">{t.category || "—"}</TableCell>
                  <TableCell className="text-xs">{t.sector || "—"}</TableCell>
                  <TableCell className="text-xs">{nameOf(t.assigned_to)}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={t.status === "finalizado" ? "default" : t.status === "reaberto" ? "destructive" : "secondary"}>
                      {t.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(t.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</TableCell>
                  <TableCell className="text-xs text-right">
                    {t.status === "finalizado"
                      ? fmtHours(hoursBetween(t.created_at, t.closed_at))
                      : fmtHours((Date.now() - new Date(t.created_at).getTime()) / 3_600_000)}
                  </TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-6">Nenhum chamado encontrado</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
