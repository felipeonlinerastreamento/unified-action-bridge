import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "@/components/relatorios/report-kpi-card";
import { exportToCSV } from "@/components/relatorios/export-utils";
import { Loader2, Star, Download } from "lucide-react";

interface Props {
  dateFrom: string;
  dateTo: string;
  operatorFilter?: string;
}

export function CsatReportTab({ dateFrom, dateTo, operatorFilter }: Props) {
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["csat-report", dateFrom, dateTo, operatorFilter],
    queryFn: async () => {
      let q = supabase
        .from("csat_responses" as any)
        .select("*")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });
      if (operatorFilter) q = q.eq("operator_user_id", operatorFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const stats = useMemo(() => {
    const total = rows.length;
    const counts = { 1: 0, 2: 0, 3: 0 } as Record<number, number>;
    let sum = 0;
    for (const r of rows) {
      counts[r.score] = (counts[r.score] || 0) + 1;
      sum += Number(r.score) || 0;
    }
    const avg = total ? sum / total : 0;
    const satisfaction = total ? ((counts[2] + counts[3]) / total) * 100 : 0;
    return { total, counts, avg, satisfaction };
  }, [rows]);

  const handleExport = () => {
    exportToCSV(
      rows.map((r: any) => ({
        Data: new Date(r.created_at).toLocaleString("pt-BR"),
        Contato: r.contact_name || "",
        Telefone: r.phone || "",
        Operador: r.operator_name || "",
        Protocolo: r.protocol || "",
        Nota: r.score,
        Avaliação: r.score_label,
      })),
      `csat_${dateFrom}_${dateTo}`,
    );
  };

  const labelBadge = (score: number) => {
    const map: Record<number, { label: string; cls: string }> = {
      1: { label: "Ruim 😒", cls: "bg-red-500/15 text-red-600" },
      2: { label: "Bom 😊", cls: "bg-yellow-500/15 text-yellow-700" },
      3: { label: "Ótimo 😍", cls: "bg-green-500/15 text-green-600" },
    };
    const m = map[score] || { label: String(score), cls: "" };
    return <Badge variant="outline" className={m.cls}>{m.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <ReportKpiCard label="Total respostas" value={stats.total} icon={Star} />
        <ReportKpiCard label="Nota média" value={stats.avg.toFixed(2)} icon={Star} />
        <ReportKpiCard label="Ruim" value={stats.counts[1] || 0} icon={Star} />
        <ReportKpiCard label="Bom" value={stats.counts[2] || 0} icon={Star} />
        <ReportKpiCard label="Ótimo" value={stats.counts[3] || 0} icon={Star} />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Histórico de avaliações</CardTitle>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!rows.length}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Nenhuma avaliação registrada no período.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Operador</TableHead>
                  <TableHead>Protocolo</TableHead>
                  <TableHead>Avaliação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{r.contact_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                    <TableCell>{r.operator_name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.protocol || "—"}</TableCell>
                    <TableCell>{labelBadge(r.score)}</TableCell>
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
