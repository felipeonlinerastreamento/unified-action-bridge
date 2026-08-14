// Seção "Qualidade & Cobertura da Equipe" do relatório Jornada & Ociosidade.
// Métricas: TMPR, tempo médio de resolução, aderência à escala, chats
// simultâneos (médio/pico), reaberturas e transferências enviadas, heatmap
// por faixa horária e CSAT por operador.
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import { ChartFrame } from "./chart-frame";
import { ReportKpiCard } from "./report-kpi-card";
import { exportToCSV } from "./export-utils";
import {
  Award, Download, Gauge, Loader2, RefreshCcw, Star, Timer, Users,
} from "lucide-react";

export interface QualityShiftRow {
  userId: string;
  userName: string;
  days: number;
  shiftMinutes: number;
}

interface Props {
  dateFrom: string;
  dateTo: string;
  operatorFilter?: string;
  localOperator: string;
  dayFilter: string;
  shiftStart: string;
  shiftEnd: string;
  opName: Record<string, string>;
  shiftRows: QualityShiftRow[];
}

function fmtHm(minutes: number) {
  if (!minutes || minutes < 0) return "0min";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h === 0 ? `${m}min` : `${h}h ${m}min`;
}

function fmtMs(ms: number) {
  if (!ms || !isFinite(ms) || ms <= 0) return "—";
  return fmtHm(ms / 60000);
}

function median(values: number[]) {
  const v = values.filter((n) => n > 0).sort((a, b) => a - b);
  if (!v.length) return 0;
  const mid = Math.floor(v.length / 2);
  return v.length % 2 ? v[mid] : (v[mid - 1] + v[mid]) / 2;
}

export function TeamQualitySection({
  dateFrom, dateTo, operatorFilter, localOperator, dayFilter,
  shiftStart, shiftEnd, opName, shiftRows,
}: Props) {
  const fromIso = `${dateFrom}T00:00:00-03:00`;
  const toIso = `${dateTo}T23:59:59-03:00`;

  const brtDay = (iso: string) => {
    const d = new Date(iso);
    d.setUTCHours(d.getUTCHours() - 3);
    return d.toISOString().slice(0, 10);
  };
  const brtHour = (iso: string) => {
    const d = new Date(iso);
    d.setUTCHours(d.getUTCHours() - 3);
    return d.getUTCHours();
  };

  const matchesOperator = (uid: string | null) =>
    !!uid && (localOperator === "__all__" || uid === localOperator);
  const matchesDay = (day: string) => dayFilter === "__all__" || day === dayFilter;

  // Todas as mensagens da janela (entrada e saída) para TMPR / simultaneidade.
  const { data: messages = [], isLoading: msgLoading } = useQuery({
    queryKey: ["quality-messages", fromIso, toIso],
    queryFn: async () => {
      const pageSize = 1000;
      let offset = 0;
      const all: Array<{
        chat_id: string; created_at: string; from_me: boolean;
        sent_by_user_id: string | null; is_whisper: boolean | null;
      }> = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const { data, error } = await supabase
          .from("zapi_messages")
          .select("chat_id, created_at, from_me, sent_by_user_id, is_whisper")
          .gte("created_at", fromIso)
          .lte("created_at", toIso)
          .order("created_at", { ascending: true })
          .range(offset, offset + pageSize - 1);
        if (error) throw error;
        const rows = (data || []) as typeof all;
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 100000) break;
      }
      return all;
    },
  });

  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["quality-chats", fromIso, toIso, operatorFilter || ""],
    queryFn: async () => {
      const pageSize = 1000;
      let offset = 0;
      const all: Array<{
        id: string; assigned_to: string | null; status: string;
        created_at: string; closed_at: string | null; last_message_at: string | null;
      }> = [];
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let q = supabase
          .from("zapi_chats")
          .select("id, assigned_to, status, created_at, closed_at, last_message_at")
          .or(
            `last_message_at.gte.${fromIso},` +
            `closed_at.gte.${fromIso},` +
            `created_at.gte.${fromIso}`
          )
          .lte("created_at", toIso)
          .order("last_message_at", { ascending: false, nullsFirst: false })
          .range(offset, offset + pageSize - 1);
        if (operatorFilter) q = q.eq("assigned_to", operatorFilter);
        const { data, error } = await q;
        if (error) throw error;
        const rows = (data || []) as typeof all;
        all.push(...rows);
        if (rows.length < pageSize) break;
        offset += pageSize;
        if (offset > 20000) break;
      }
      return all;
    },
  });

  const { data: csat = [] } = useQuery({
    queryKey: ["quality-csat", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csat_responses")
        .select("operator_user_id, score, created_at")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000);
      if (error) throw error;
      return (data || []) as Array<{
        operator_user_id: string | null; score: number; created_at: string;
      }>;
    },
  });

  const { data: transfersSent = [] } = useQuery({
    queryKey: ["quality-transfers", fromIso, toIso],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("audit_logs")
        .select("user_id, created_at")
        .eq("event_type", "chat.transferido")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .limit(5000);
      if (error) throw error;
      return (data || []) as Array<{ user_id: string | null; created_at: string }>;
    },
  });

  const loading = msgLoading || chatsLoading;

  type Row = {
    userId: string; userName: string;
    tmprMs: number; tmprCount: number;
    tmrMs: number; tmrCount: number;
    adherence: number;
    simultAvg: number; simultPeak: number;
    reopened: number; transfersOut: number;
    csatAvg: number; csatCount: number;
  };

  const shiftWindowMinutes = useMemo(() => {
    const [sh, sm] = shiftStart.split(":").map(Number);
    const [eh, em] = shiftEnd.split(":").map(Number);
    return Math.max(0, (eh * 60 + em) - (sh * 60 + sm));
  }, [shiftStart, shiftEnd]);

  const rows = useMemo<Row[]>(() => {
    const acc: Record<string, Row> = {};
    const ensure = (id: string) => {
      if (!acc[id]) {
        acc[id] = {
          userId: id, userName: opName[id] || "—",
          tmprMs: 0, tmprCount: 0, tmrMs: 0, tmrCount: 0,
          adherence: 0, simultAvg: 0, simultPeak: 0,
          reopened: 0, transfersOut: 0, csatAvg: 0, csatCount: 0,
        };
      }
      return acc[id];
    };

    // Agrupa mensagens por chat
    const byChat = new Map<string, typeof messages>();
    messages.forEach((m) => {
      if (!matchesDay(brtDay(m.created_at))) return;
      const arr = byChat.get(m.chat_id) || [];
      arr.push(m);
      byChat.set(m.chat_id, arr);
    });

    // TMPR: 1ª msg do cliente → 1ª resposta do operador
    byChat.forEach((msgs) => {
      const sorted = msgs.slice().sort(
        (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
      );
      const firstIn = sorted.find((m) => m.from_me === false);
      if (!firstIn) return;
      const resp = sorted.find(
        (m) => m.from_me === true && !m.is_whisper && m.sent_by_user_id &&
          new Date(m.created_at).getTime() > new Date(firstIn.created_at).getTime()
      );
      if (!resp?.sent_by_user_id || !matchesOperator(resp.sent_by_user_id)) return;
      const row = ensure(resp.sent_by_user_id);
      row.tmprMs += new Date(resp.created_at).getTime() - new Date(firstIn.created_at).getTime();
      row.tmprCount += 1;
    });

    // Tempo médio de resolução + reaberturas
    chats.forEach((c) => {
      if (!matchesOperator(c.assigned_to)) return;
      const uid = c.assigned_to as string;
      if (c.status === "reaberto") {
        if (matchesDay(brtDay(c.last_message_at || c.created_at))) ensure(uid).reopened += 1;
      }
      if (c.status === "finalizado" && c.closed_at) {
        if (!matchesDay(brtDay(c.closed_at))) return;
        const row = ensure(uid);
        row.tmrMs += Math.max(0, new Date(c.closed_at).getTime() - new Date(c.created_at).getTime());
        row.tmrCount += 1;
      }
    });

    // Simultaneidade: buckets de 30min por operador/dia
    const buckets = new Map<string, Map<string, Set<string>>>(); // user -> bucketKey -> chats
    messages.forEach((m) => {
      if (!m.from_me || !m.sent_by_user_id || m.is_whisper) return;
      if (!matchesOperator(m.sent_by_user_id)) return;
      const day = brtDay(m.created_at);
      if (!matchesDay(day)) return;
      const t = new Date(m.created_at).getTime();
      const bucketKey = String(Math.floor(t / (30 * 60000)));
      const forUser = buckets.get(m.sent_by_user_id) || new Map<string, Set<string>>();
      const set = forUser.get(bucketKey) || new Set<string>();
      set.add(m.chat_id);
      forUser.set(bucketKey, set);
      buckets.set(m.sent_by_user_id, forUser);
    });
    buckets.forEach((forUser, uid) => {
      const counts = Array.from(forUser.values()).map((s) => s.size);
      const row = ensure(uid);
      row.simultAvg = counts.length ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
      row.simultPeak = counts.length ? Math.max(...counts) : 0;
    });

    // Transferências enviadas
    transfersSent.forEach((t) => {
      if (!matchesOperator(t.user_id)) return;
      if (!matchesDay(brtDay(t.created_at))) return;
      ensure(t.user_id as string).transfersOut += 1;
    });

    // CSAT
    const csatAcc: Record<string, { sum: number; n: number }> = {};
    csat.forEach((c) => {
      if (!matchesOperator(c.operator_user_id)) return;
      if (!matchesDay(brtDay(c.created_at))) return;
      const uid = c.operator_user_id as string;
      csatAcc[uid] ||= { sum: 0, n: 0 };
      csatAcc[uid].sum += Number(c.score) || 0;
      csatAcc[uid].n += 1;
    });
    Object.entries(csatAcc).forEach(([uid, v]) => {
      const row = ensure(uid);
      row.csatAvg = v.n ? v.sum / v.n : 0;
      row.csatCount = v.n;
    });

    // Aderência à escala
    shiftRows.forEach((s) => {
      if (!matchesOperator(s.userId)) return;
      const target = s.days * shiftWindowMinutes;
      if (target <= 0) return;
      ensure(s.userId).adherence = Math.min(1, s.shiftMinutes / target);
    });

    return Object.values(acc)
      .map((r) => ({ ...r, userName: opName[r.userId] || r.userName }))
      .sort((a, b) => b.tmprCount - a.tmprCount);
  }, [messages, chats, csat, transfersSent, shiftRows, opName, localOperator, dayFilter, shiftWindowMinutes]);

  const totals = useMemo(() => {
    const tmprMs = rows.reduce((s, r) => s + r.tmprMs, 0);
    const tmprCount = rows.reduce((s, r) => s + r.tmprCount, 0);
    const tmrMs = rows.reduce((s, r) => s + r.tmrMs, 0);
    const tmrCount = rows.reduce((s, r) => s + r.tmrCount, 0);
    const csatSum = rows.reduce((s, r) => s + r.csatAvg * r.csatCount, 0);
    const csatN = rows.reduce((s, r) => s + r.csatCount, 0);
    const adherenceVals = rows.map((r) => r.adherence).filter((v) => v > 0);
    return {
      tmpr: tmprCount ? tmprMs / tmprCount : 0,
      tmr: tmrCount ? tmrMs / tmrCount : 0,
      csat: csatN ? csatSum / csatN : 0,
      csatN,
      adherence: adherenceVals.length
        ? adherenceVals.reduce((a, b) => a + b, 0) / adherenceVals.length : 0,
      peak: rows.length ? Math.max(...rows.map((r) => r.simultPeak)) : 0,
      reopened: rows.reduce((s, r) => s + r.reopened, 0),
      transfersOut: rows.reduce((s, r) => s + r.transfersOut, 0),
    };
  }, [rows]);

  const tmprMedian = useMemo(
    () => median(rows.map((r) => (r.tmprCount ? r.tmprMs / r.tmprCount : 0))),
    [rows]
  );

  // Heatmap por faixa horária (mensagens enviadas por hora)
  const hourly = useMemo(() => {
    const [sh] = shiftStart.split(":").map(Number);
    const [eh] = shiftEnd.split(":").map(Number);
    const from = Math.min(sh ?? 8, 23);
    const to = Math.max(eh ?? 18, from + 1);
    const counts: Record<number, number> = {};
    messages.forEach((m) => {
      if (!m.from_me || !m.sent_by_user_id || m.is_whisper) return;
      if (!matchesOperator(m.sent_by_user_id)) return;
      const day = brtDay(m.created_at);
      if (!matchesDay(day)) return;
      const h = brtHour(m.created_at);
      counts[h] = (counts[h] || 0) + 1;
    });
    const out: Array<{ hour: string; mensagens: number }> = [];
    for (let h = from; h <= to; h++) {
      out.push({ hour: `${String(h).padStart(2, "0")}h`, mensagens: counts[h] || 0 });
    }
    return out;
  }, [messages, shiftStart, shiftEnd, localOperator, dayFilter]);

  const exportRows = () => {
    exportToCSV(
      rows.map((r) => ({
        Operador: r.userName,
        TMPR: fmtMs(r.tmprCount ? r.tmprMs / r.tmprCount : 0),
        "Chats TMPR": r.tmprCount,
        "Tempo médio de resolução": fmtMs(r.tmrCount ? r.tmrMs / r.tmrCount : 0),
        Resolvidos: r.tmrCount,
        "Aderência %": (r.adherence * 100).toFixed(0),
        "Simultâneos médio": r.simultAvg.toFixed(1),
        "Simultâneos pico": r.simultPeak,
        Reaberturas: r.reopened,
        "Transferências enviadas": r.transfersOut,
        CSAT: r.csatCount ? r.csatAvg.toFixed(2) : "—",
        "Respostas CSAT": r.csatCount,
      })),
      `qualidade-equipe-${dateFrom}_${dateTo}`,
    );
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-base font-semibold flex items-center gap-2">
          <Award className="h-4 w-4" /> Qualidade &amp; Cobertura da Equipe
        </h3>
        <Button size="sm" variant="outline" onClick={exportRows} disabled={rows.length === 0}>
          <Download className="h-3.5 w-3.5 mr-1" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard
          title="TMPR (1ª resposta)"
          value={fmtMs(totals.tmpr)}
          icon={Timer}
          subtitle="Média da equipe"
        />
        <ReportKpiCard
          title="Tempo médio de resolução"
          value={fmtMs(totals.tmr)}
          icon={Gauge}
        />
        <ReportKpiCard
          title={`Aderência ${shiftStart}–${shiftEnd}`}
          value={`${(totals.adherence * 100).toFixed(0)}%`}
          icon={Users}
          subtitle="Presença na janela"
        />
        <ReportKpiCard
          title="CSAT médio"
          value={totals.csatN ? totals.csat.toFixed(2) : "—"}
          icon={Star}
          subtitle={`${totals.csatN} respostas`}
        />
      </div>

      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard title="Pico de chats simultâneos" value={totals.peak} icon={Users} />
        <ReportKpiCard title="Reaberturas" value={totals.reopened} icon={RefreshCcw} />
        <ReportKpiCard title="Transferências enviadas" value={totals.transfersOut} icon={RefreshCcw} />
        <ReportKpiCard
          title="Operadores avaliados"
          value={rows.length}
          icon={Award}
        />
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <ChartFrame
          title={`Distribuição por faixa horária (${shiftStart}–${shiftEnd})`}
          filename="faixa-horaria"
          data={hourly}
        >
          <ChartContainer
            config={{ mensagens: { label: "Mensagens", color: "hsl(var(--chart-1))" } }}
            className="h-[240px] w-full"
          >
            <BarChart data={hourly}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="mensagens" fill="var(--color-mensagens)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartFrame>

        <ChartFrame
          title="Chats simultâneos (médio x pico)"
          filename="chats-simultaneos"
          data={rows.map((r) => ({
            Operador: r.userName,
            Médio: Number(r.simultAvg.toFixed(1)),
            Pico: r.simultPeak,
          }))}
        >
          <ChartContainer
            config={{
              medio: { label: "Médio", color: "hsl(var(--chart-2))" },
              pico: { label: "Pico", color: "hsl(var(--chart-4))" },
            }}
            className="h-[240px] w-full"
          >
            <BarChart
              data={rows.map((r) => ({
                name: r.userName,
                medio: Number(r.simultAvg.toFixed(1)),
                pico: r.simultPeak,
              }))}
            >
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 10 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="medio" fill="var(--color-medio)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="pico" fill="var(--color-pico)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </ChartFrame>
      </div>

      <Card>
        <CardContent className="pt-4">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              Sem dados de qualidade no período selecionado.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead className="text-right">TMPR</TableHead>
                    <TableHead className="text-right">Resolução média</TableHead>
                    <TableHead className="text-right">Aderência</TableHead>
                    <TableHead className="text-right">Simult. médio</TableHead>
                    <TableHead className="text-right">Pico</TableHead>
                    <TableHead className="text-right">Reaberturas</TableHead>
                    <TableHead className="text-right">Transf. enviadas</TableHead>
                    <TableHead className="text-right">CSAT</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const tmpr = r.tmprCount ? r.tmprMs / r.tmprCount : 0;
                    const slow = tmprMedian > 0 && tmpr > tmprMedian;
                    return (
                      <TableRow key={r.userId}>
                        <TableCell className="font-medium">{r.userName}</TableCell>
                        <TableCell className="text-right">
                          <span className={slow ? "text-amber-700" : "text-emerald-700"}>
                            {fmtMs(tmpr)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {fmtMs(r.tmrCount ? r.tmrMs / r.tmrCount : 0)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant="outline"
                            className={
                              r.adherence >= 0.85
                                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                                : r.adherence >= 0.6
                                  ? "bg-amber-50 text-amber-700 border-amber-200"
                                  : "bg-red-50 text-red-700 border-red-200"
                            }
                          >
                            {(r.adherence * 100).toFixed(0)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{r.simultAvg.toFixed(1)}</TableCell>
                        <TableCell className="text-right">{r.simultPeak}</TableCell>
                        <TableCell className="text-right">{r.reopened}</TableCell>
                        <TableCell className="text-right">{r.transfersOut}</TableCell>
                        <TableCell className="text-right">
                          {r.csatCount ? `${r.csatAvg.toFixed(2)} (${r.csatCount})` : "—"}
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
