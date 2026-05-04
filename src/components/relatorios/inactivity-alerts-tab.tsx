import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertTriangle } from "lucide-react";

type Props = {
  dateFrom: string;
  dateTo: string;
};

export function InactivityAlertsTab({ dateFrom, dateTo }: Props) {
  const { data: logs = [], isLoading } = useQuery({
    queryKey: ["inactivity-alert-logs", dateFrom, dateTo],
    queryFn: async () => {
      const from = new Date(`${dateFrom}T00:00:00`).toISOString();
      const to = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data } = await supabase
        .from("chat_inactivity_alert_logs" as any)
        .select("*")
        .gte("triggered_at", from)
        .lte("triggered_at", to)
        .order("triggered_at", { ascending: false })
        .limit(500);
      return (data as any[]) || [];
    },
  });

  const stats = useMemo(() => {
    const total = logs.length;
    const acknowledged = logs.filter((l: any) => !!l.acknowledged_at).length;
    const pending = total - acknowledged;
    const avgAck = (() => {
      const acks = logs
        .filter((l: any) => l.acknowledged_at)
        .map((l: any) => new Date(l.acknowledged_at).getTime() - new Date(l.triggered_at).getTime());
      if (!acks.length) return 0;
      return Math.round(acks.reduce((a, b) => a + b, 0) / acks.length / 1000);
    })();
    return { total, acknowledged, pending, avgAck };
  }, [logs]);

  function fmt(ts?: string | null) {
    if (!ts) return "—";
    return new Date(ts).toLocaleString("pt-BR");
  }

  function fmtDuration(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    if (m < 60) return s ? `${m}m ${s}s` : `${m}m`;
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return rm ? `${h}h ${rm}m` : `${h}h`;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <KpiCard label="Total de alertas" value={stats.total} />
        <KpiCard label="Visualizados" value={stats.acknowledged} accent="text-emerald-600" />
        <KpiCard label="Pendentes" value={stats.pending} accent="text-amber-600" />
        <KpiCard label="Tempo médio até visualizar" value={stats.avgAck > 0 ? fmtDuration(stats.avgAck) : "—"} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            Alertas de inatividade
          </CardTitle>
          <CardDescription>
            Histórico de balões "Necessário interação" disparados aos operadores no período.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : logs.length === 0 ? (
            <p className="text-sm text-muted-foreground py-8 text-center">
              Nenhum alerta de inatividade no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Disparado em</TableHead>
                    <TableHead className="text-xs">Contato</TableHead>
                    <TableHead className="text-xs">Telefone</TableHead>
                    <TableHead className="text-xs">Operador</TableHead>
                    <TableHead className="text-xs">Inativo (min)</TableHead>
                    <TableHead className="text-xs">Visualizado em</TableHead>
                    <TableHead className="text-xs">Tempo p/ ver</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.map((l: any) => {
                    const ackSecs = l.acknowledged_at
                      ? Math.round((new Date(l.acknowledged_at).getTime() - new Date(l.triggered_at).getTime()) / 1000)
                      : null;
                    return (
                      <TableRow key={l.id}>
                        <TableCell className="text-xs">{fmt(l.triggered_at)}</TableCell>
                        <TableCell className="text-xs">{l.contact_name || "—"}</TableCell>
                        <TableCell className="text-xs">{l.chat_phone || "—"}</TableCell>
                        <TableCell className="text-xs">{l.recipient_name || "—"}</TableCell>
                        <TableCell className="text-xs">{l.inactivity_minutes}</TableCell>
                        <TableCell className="text-xs">{fmt(l.acknowledged_at)}</TableCell>
                        <TableCell className="text-xs">
                          {ackSecs !== null ? fmtDuration(ackSecs) : "—"}
                        </TableCell>
                        <TableCell className="text-xs">
                          {l.acknowledged_at ? (
                            <Badge variant="outline" className="text-emerald-700 border-emerald-300">
                              Visualizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-amber-700 border-amber-300">
                              Pendente
                            </Badge>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: string | number; accent?: string }) {
  return (
    <Card>
      <CardContent className="pt-4 pb-3">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`text-2xl font-bold ${accent || ""}`}>{value}</p>
      </CardContent>
    </Card>
  );
}
