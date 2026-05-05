import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "@/components/relatorios/report-kpi-card";
import { exportToCSV } from "@/components/relatorios/export-utils";
import { Loader2, Star, Download, MessageSquare, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  dateFrom: string;
  dateTo: string;
  operatorFilter?: string;
}

export function CsatReportTab({ dateFrom, dateTo, operatorFilter }: Props) {
  const [scoreFilter, setScoreFilter] = useState<number | null>(null);

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
    return { total, counts, avg };
  }, [rows]);

  const filteredRows = useMemo(
    () => (scoreFilter == null ? rows : rows.filter((r: any) => Number(r.score) === scoreFilter)),
    [rows, scoreFilter],
  );

  const handleExport = () => {
    exportToCSV(
      filteredRows.map((r: any) => ({
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

  const toggleScore = (s: number) => setScoreFilter((prev) => (prev === s ? null : s));

  const kpiBtnClass = (active: boolean) =>
    cn(
      "text-left transition-all rounded-lg",
      "hover:ring-2 hover:ring-primary/40 cursor-pointer",
      active && "ring-2 ring-primary",
    );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div><ReportKpiCard title="Total respostas" value={stats.total} icon={Star} /></div>
        <div><ReportKpiCard title="Nota média" value={stats.avg.toFixed(2)} icon={Star} /></div>
        <button type="button" onClick={() => toggleScore(1)} className={kpiBtnClass(scoreFilter === 1)}>
          <ReportKpiCard title="Ruim 😒" value={stats.counts[1] || 0} icon={Star} subtitle="Clique para filtrar" />
        </button>
        <button type="button" onClick={() => toggleScore(2)} className={kpiBtnClass(scoreFilter === 2)}>
          <ReportKpiCard title="Bom 😊" value={stats.counts[2] || 0} icon={Star} subtitle="Clique para filtrar" />
        </button>
        <button type="button" onClick={() => toggleScore(3)} className={kpiBtnClass(scoreFilter === 3)}>
          <ReportKpiCard title="Ótimo 😍" value={stats.counts[3] || 0} icon={Star} subtitle="Clique para filtrar" />
        </button>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base">Histórico de avaliações</CardTitle>
            {scoreFilter != null && (
              <Badge variant="outline" className="gap-1">
                Filtro: {labelBadge(scoreFilter)}
                <button onClick={() => setScoreFilter(null)} className="ml-1" aria-label="Limpar filtro">
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
          <Button size="sm" variant="outline" onClick={handleExport} disabled={!filteredRows.length}>
            <Download className="h-4 w-4 mr-1" /> Exportar CSV
          </Button>
        </CardHeader>
        <CardContent>
          {filteredRows.length === 0 ? (
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
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRows.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{new Date(r.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>{r.contact_name || "—"}</TableCell>
                    <TableCell className="text-xs">{r.phone || "—"}</TableCell>
                    <TableCell>{r.operator_name || "—"}</TableCell>
                    <TableCell className="text-xs font-mono">{r.protocol || "—"}</TableCell>
                    <TableCell>{labelBadge(r.score)}</TableCell>
                    <TableCell className="text-right">
                      {r.chat_id ? (
                        <Button asChild size="sm" variant="ghost" title="Abrir conversa">
                          <Link
                            to="/central"
                            search={{ chat: r.chat_id, channel: r.channel_id || undefined }}
                          >
                            <MessageSquare className="h-4 w-4" />
                          </Link>
                        </Button>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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
