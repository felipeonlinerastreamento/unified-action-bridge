import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "./report-kpi-card";
import { exportToCSV, exportToPDF } from "./export-utils";
import { formatBRL } from "@/hooks/use-perdidos";
import { formatTicketProtocol } from "@/lib/protocol-format";
import { Loader2, PackageX, Hash, DollarSign, Download, FileText } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip,
} from "recharts";

interface Props {
  dateFrom: string;
  dateTo: string;
}

export function PerdidosReportTab({ dateFrom, dateTo }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["report-perdidos", dateFrom, dateTo],
    queryFn: async () => {
      const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toIso = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("ticket_perdidos_items" as any)
        .select(`
          id, ticket_id, item_id, item_name, quantity, unit_value, total_value, created_at,
          ticket:service_tickets(id, attendance_id, protocol_number, contact_name, company:companies(name))
        `)
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const totals = useMemo(() => {
    const totalLines = rows.length;
    const totalQty = rows.reduce((acc, r) => acc + Number(r.quantity || 0), 0);
    const totalValue = rows.reduce((acc, r) => acc + Number(r.total_value || 0), 0);
    return { totalLines, totalQty, totalValue };
  }, [rows]);

  const byItem = useMemo(() => {
    const map = new Map<string, { name: string; quantity: number; total: number }>();
    rows.forEach((r) => {
      const cur = map.get(r.item_name) || { name: r.item_name, quantity: 0, total: 0 };
      cur.quantity += Number(r.quantity || 0);
      cur.total += Number(r.total_value || 0);
      map.set(r.item_name, cur);
    });
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [rows]);

  const handleExportCSV = () => {
    exportToCSV(
      rows.map((r) => ({
        Data: new Date(r.created_at).toLocaleString("pt-BR"),
        Protocolo: formatTicketProtocol(r.ticket, r.ticket?.attendance_id),
        Empresa: r.ticket?.company?.name || "—",
        Contato: r.ticket?.contact_name || "—",
        Item: r.item_name,
        Quantidade: r.quantity,
        "Valor unitário": Number(r.unit_value).toFixed(2).replace(".", ","),
        "Valor total": Number(r.total_value).toFixed(2).replace(".", ","),
      })),
      `itens-perdidos-${dateFrom}-a-${dateTo}`,
    );
  };

  return (
    <div className="space-y-4" id="perdidos-report">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <ReportKpiCard
          title="Itens registrados"
          value={totals.totalLines}
          icon={PackageX}
        />
        <ReportKpiCard
          title="Quantidade total"
          value={totals.totalQty}
          icon={Hash}
        />
        <ReportKpiCard
          title="Valor total"
          value={formatBRL(totals.totalValue)}
          icon={DollarSign}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Resumo por item</CardTitle>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={handleExportCSV}>
              <Download className="h-4 w-4 mr-1" /> CSV
            </Button>
            <Button size="sm" variant="outline" onClick={() => exportToPDF("perdidos-report", "itens-perdidos")}>
              <FileText className="h-4 w-4 mr-1" /> PDF
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {byItem.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sem dados no período.</p>
          ) : (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byItem}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip formatter={(value: any) => formatBRL(Number(value))} />
                  <Bar dataKey="total" name="Valor total" fill="hsl(var(--chart-1))" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Detalhamento</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">Sem itens registrados no período.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Item</TableHead>
                  <TableHead className="text-right">Qtd</TableHead>
                  <TableHead className="text-right">Valor unitário</TableHead>
                  <TableHead className="text-right">Valor total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">
                      {new Date(r.created_at).toLocaleString("pt-BR")}
                    </TableCell>
                    <TableCell className="text-xs font-mono">
                      {formatTicketProtocol(r.ticket, r.ticket?.attendance_id)}
                    </TableCell>
                    <TableCell className="text-xs">{r.ticket?.company?.name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.item_name}</TableCell>
                    <TableCell className="text-xs text-right">{r.quantity}</TableCell>
                    <TableCell className="text-xs text-right">{formatBRL(r.unit_value)}</TableCell>
                    <TableCell className="text-xs text-right font-semibold">
                      {formatBRL(r.total_value)}
                    </TableCell>
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
