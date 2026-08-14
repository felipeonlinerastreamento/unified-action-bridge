import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "./report-kpi-card";
import { exportToCSV, exportToPDF } from "./export-utils";
import { formatBRL, useOperatorOptions } from "@/hooks/use-ticket-errors";
import { formatTicketProtocol } from "@/lib/protocol-format";
import {
  Loader2, AlertTriangle, Hash, DollarSign, TrendingUp, Download, FileText, Search,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
  LineChart, Line,
} from "recharts";

interface Props {
  dateFrom: string;
  dateTo: string;
}

export function ErrorsReportTab({ dateFrom, dateTo }: Props) {
  const [operatorId, setOperatorId] = useState("");
  const [search, setSearch] = useState("");
  const { data: operators = [] } = useOperatorOptions();

  const { data: rowsRaw = [], isLoading } = useQuery({
    queryKey: ["report-errors", dateFrom, dateTo],
    queryFn: async () => {
      const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toIso = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("ticket_error_entries" as any)
        .select(`
          id, ticket_id, operator_user_id, operator_name, description, amount, created_at,
          ticket:service_tickets(id, attendance_id, protocol_number, contact_name, category, company:companies(name))
        `)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const rows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rowsRaw.filter((r) => {
      if (operatorId && r.operator_user_id !== operatorId) return false;
      if (!term) return true;
      const proto = formatTicketProtocol(r.ticket?.protocol_number ?? r.ticket?.attendance_id) || "";
      const hay = [
        proto,
        String(r.ticket?.protocol_number ?? ""),
        r.ticket?.contact_name ?? "",
        r.ticket?.company?.name ?? "",
        r.operator_name ?? "",
        r.description ?? "",
      ].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [rowsRaw, operatorId, search]);

  const totals = useMemo(() => {
    const count = rows.length;
    const totalValue = rows.reduce((acc, r) => acc + Number(r.amount || 0), 0);
    const avg = count ? totalValue / count : 0;
    const byOp = new Map<string, { name: string; value: number; count: number }>();
    for (const r of rows) {
      const key = r.operator_user_id || r.operator_name || "—";
      const cur = byOp.get(key) || { name: r.operator_name || "—", value: 0, count: 0 };
      cur.value += Number(r.amount || 0);
      cur.count += 1;
      byOp.set(key, cur);
    }
    const list = Array.from(byOp.values()).sort((a, b) => b.value - a.value);
    return { count, totalValue, avg, byOperator: list, top: list[0] };
  }, [rows]);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of rows) {
      const d = new Date(r.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
      map.set(d, (map.get(d) || 0) + Number(r.amount || 0));
    }
    return Array.from(map.entries())
      .map(([day, value]) => ({ day, value }))
      .sort((a, b) => {
        const [da, ma, ya] = a.day.split("/").map(Number);
        const [db, mb, yb] = b.day.split("/").map(Number);
        return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
      });
  }, [rows]);

  const handleExportCSV = () => {
    exportToCSV(
      rows.map((r) => ({
        Data: new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
        Protocolo: formatTicketProtocol(r.ticket?.protocol_number ?? r.ticket?.attendance_id) || "",
        Cliente: r.ticket?.company?.name || r.ticket?.contact_name || "",
        Categoria: r.ticket?.category || "",
        Operador: r.operator_name || "",
        Descricao: r.description || "",
        Valor: Number(r.amount || 0).toFixed(2).replace(".", ","),
      })),
      "relatorio-erros",
    );
  };

  return (
    <div className="space-y-4" id="errors-report-content">
      <div className="flex flex-wrap items-end gap-3 p-3 rounded-lg border bg-card">
        <div>
          <Label className="text-xs">Operador</Label>
          <Select value={operatorId || "all"} onValueChange={(v) => setOperatorId(v === "all" ? "" : v)}>
            <SelectTrigger className="w-[190px] h-8 text-xs">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os operadores</SelectItem>
              {operators.map((o) => (
                <SelectItem key={o.user_id} value={o.user_id}>{o.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Buscar</Label>
          <div className="relative">
            <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Protocolo, cliente, descrição"
              className="h-8 text-xs w-[240px] pl-7"
            />
          </div>
        </div>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" onClick={handleExportCSV} className="gap-1.5">
            <Download className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => exportToPDF("errors-report-content", "relatorio-erros")}
            className="gap-1.5"
          >
            <FileText className="h-3.5 w-3.5" /> PDF
          </Button>
        </div>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard title="Total de erros" value={totals.count} icon={Hash} />
        <ReportKpiCard title="Valor total" value={formatBRL(totals.totalValue)} icon={DollarSign} />
        <ReportKpiCard title="Valor médio" value={formatBRL(totals.avg)} icon={TrendingUp} />
        <ReportKpiCard
          title="Maior acumulado"
          value={totals.top ? totals.top.name : "—"}
          subtitle={totals.top ? formatBRL(totals.top.value) : undefined}
          icon={AlertTriangle}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame title="Valor por operador" data={totals.byOperator as any} filename="erros-valor-por-operador">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={totals.byOperator}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 10 }} />
                <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
                <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>

        <ChartFrame title="Quantidade de erros por operador" data={totals.byOperator as any} filename="erros-qtd-por-operador">
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={totals.byOperator}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </ChartFrame>
      </div>

      <ChartFrame title="Evolução do valor no período" data={byDay as any} filename="erros-evolucao">
        <div className="h-[240px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="day" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v: any) => formatBRL(Number(v))} />
              <Line type="monotone" dataKey="value" stroke="hsl(var(--destructive))" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </ChartFrame>


      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento ({rows.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Protocolo</TableHead>
                <TableHead>Cliente</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Operador</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground text-sm">
                    Nenhum erro registrado no período.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {new Date(r.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {formatTicketProtocol(r.ticket?.protocol_number ?? r.ticket?.attendance_id) || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.ticket?.company?.name || r.ticket?.contact_name || "—"}
                    </TableCell>
                    <TableCell className="text-xs">{r.ticket?.category || "—"}</TableCell>
                    <TableCell className="text-xs">{r.operator_name || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{r.description || "—"}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">{formatBRL(r.amount)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
