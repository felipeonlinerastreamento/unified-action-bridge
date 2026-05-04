import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Loader2, Bell, CheckCircle2, Clock } from "lucide-react";
import { ReportKpiCard } from "./report-kpi-card";

interface Props {
  dateFrom: string;
  dateTo: string;
}

interface LogRow {
  id: string;
  user_id: string;
  trigger_type: "auto" | "manual";
  shown_at: string;
  acknowledged_at: string | null;
  total_pending: number;
  user_name?: string;
}

export function RemindersTab({ dateFrom, dateTo }: Props) {
  const [rows, setRows] = useState<LogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerFilter, setTriggerFilter] = useState<"all" | "auto" | "manual">("all");
  const [userFilter, setUserFilter] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const fromIso = new Date(dateFrom + "T00:00:00").toISOString();
      const toIso = new Date(dateTo + "T23:59:59").toISOString();

      const { data, error } = await supabase
        .from("pending_reminder_dispatch_log" as any)
        .select("*")
        .gte("shown_at", fromIso)
        .lte("shown_at", toIso)
        .order("shown_at", { ascending: false });

      if (error) {
        console.error(error);
        setRows([]);
        setLoading(false);
        return;
      }

      const list = (data as any[]) || [];
      const userIds = Array.from(new Set(list.map((r) => r.user_id)));
      let nameMap = new Map<string, string>();
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, name")
          .in("user_id", userIds);
        (profs || []).forEach((p: any) => nameMap.set(p.user_id, p.name || ""));
      }

      setRows(
        list.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          trigger_type: r.trigger_type,
          shown_at: r.shown_at,
          acknowledged_at: r.acknowledged_at,
          total_pending: r.total_pending ?? 0,
          user_name: nameMap.get(r.user_id) || r.user_id.slice(0, 8),
        })),
      );
      setLoading(false);
    })();
  }, [dateFrom, dateTo]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (triggerFilter !== "all" && r.trigger_type !== triggerFilter) return false;
      if (userFilter && !r.user_name?.toLowerCase().includes(userFilter.toLowerCase())) return false;
      return true;
    });
  }, [rows, triggerFilter, userFilter]);

  const total = filtered.length;
  const acknowledged = filtered.filter((r) => r.acknowledged_at).length;
  const manualCount = filtered.filter((r) => r.trigger_type === "manual").length;
  const avgAckSeconds = useMemo(() => {
    const acks = filtered.filter((r) => r.acknowledged_at);
    if (acks.length === 0) return 0;
    const sum = acks.reduce(
      (acc, r) =>
        acc +
        (new Date(r.acknowledged_at!).getTime() - new Date(r.shown_at).getTime()) / 1000,
      0,
    );
    return Math.round(sum / acks.length);
  }, [filtered]);

  function fmt(ts: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("pt-BR");
  }

  function fmtDur(seconds: number) {
    if (!seconds) return "—";
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  }

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard title="Disparos no período" value={total} icon={Bell} subtitle={`${dateFrom} a ${dateTo}`} />
        <ReportKpiCard title="Confirmados" value={acknowledged} icon={CheckCircle2} subtitle={`${total ? Math.round((acknowledged / total) * 100) : 0}% do total`} />
        <ReportKpiCard title="Manuais" value={manualCount} icon={Bell} subtitle={`${total - manualCount} automáticos`} />
        <ReportKpiCard title="Tempo médio p/ confirmar" value={fmtDur(avgAckSeconds)} icon={Clock} />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Tipo de disparo</label>
            <Select value={triggerFilter} onValueChange={(v: any) => setTriggerFilter(v)}>
              <SelectTrigger className="w-48">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="auto">Automático</SelectItem>
                <SelectItem value="manual">Manual</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <label className="text-xs text-muted-foreground">Usuário</label>
            <Input
              placeholder="Filtrar por nome..."
              value={userFilter}
              onChange={(e) => setUserFilter(e.target.value)}
              className="w-64"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Histórico de lembretes ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-auto max-h-[600px]">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Hora do disparo</th>
                  <th className="text-left px-3 py-2 font-medium">Destinatário</th>
                  <th className="text-left px-3 py-2 font-medium">Tipo</th>
                  <th className="text-left px-3 py-2 font-medium">Pendências</th>
                  <th className="text-left px-3 py-2 font-medium">Visualizado em</th>
                  <th className="text-left px-3 py-2 font-medium">Tempo p/ confirmar</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground">
                      Nenhum disparo no período.
                    </td>
                  </tr>
                )}
                {filtered.map((r) => {
                  const ackSec = r.acknowledged_at
                    ? Math.round(
                        (new Date(r.acknowledged_at).getTime() - new Date(r.shown_at).getTime()) / 1000,
                      )
                    : 0;
                  return (
                    <tr key={r.id} className="border-t hover:bg-muted/30">
                      <td className="px-3 py-2 whitespace-nowrap">{fmt(r.shown_at)}</td>
                      <td className="px-3 py-2">{r.user_name}</td>
                      <td className="px-3 py-2">
                        <Badge variant={r.trigger_type === "manual" ? "default" : "secondary"} className="text-[10px]">
                          {r.trigger_type === "manual" ? "Manual" : "Automático"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2">{r.total_pending}</td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {r.acknowledged_at ? (
                          <span className="text-emerald-600">{fmt(r.acknowledged_at)}</span>
                        ) : (
                          <span className="text-muted-foreground">Não confirmado</span>
                        )}
                      </td>
                      <td className="px-3 py-2">{fmtDur(ackSec)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
