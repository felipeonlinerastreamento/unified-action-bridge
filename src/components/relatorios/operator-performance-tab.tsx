import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  Trophy, Clock, TrendingUp, AlertTriangle, Target, Loader2, ListChecks,
} from "lucide-react";
import {
  computeFirstResponseTimes, computeIdleness, computeProductivity,
  computeSectorBottlenecks, suggestActions, formatDuration, formatPct,
  type DataSource,
} from "@/lib/operator-metrics";

interface Props {
  dateFrom: string;
  dateTo: string;
}

export function OperatorPerformanceTab({ dateFrom, dateTo }: Props) {
  const [source, setSource] = useState<DataSource>("ambos");
  const [sector, setSector] = useState<string>("__all__");
  const [category, setCategory] = useState<string>("__all__");
  const [idleThresholdMin, setIdleThresholdMin] = useState<number>(10);

  // Operators
  const { data: operators = [] } = useQuery({
    queryKey: ["perf-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name");
      if (error) throw error;
      return (data || []).map((p: any) => ({ id: p.user_id, name: p.name || "Sem nome" }));
    },
  });

  // Sectors
  const { data: sectors = [] } = useQuery({
    queryKey: ["perf-sectors"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sectors").select("id,name").order("name");
      if (error) throw error;
      return data || [];
    },
  });

  // Tickets in range
  const { data: tickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["perf-tickets", dateFrom, dateTo],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_tickets")
        .select("id,assigned_to,sector,category,status,created_at,closed_at")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  // Chats in range
  const { data: chats = [], isLoading: chatsLoading } = useQuery({
    queryKey: ["perf-chats", dateFrom, dateTo],
    refetchInterval: 10_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapi_chats")
        .select("id,assigned_to,sector_name,status,created_at,last_message_at")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .limit(5000);
      if (error) throw error;
      return data || [];
    },
  });

  // Messages for the chats above (only what we need)
  const chatIds = useMemo(() => chats.map((c: any) => c.id), [chats]);
  const { data: messages = [], isLoading: msgsLoading } = useQuery({
    queryKey: ["perf-messages", chatIds.length, dateFrom, dateTo],
    enabled: chatIds.length > 0,
    refetchInterval: 10_000,
    queryFn: async () => {
      // Chunk to avoid URL length limits
      const out: any[] = [];
      const chunkSize = 100;
      for (let i = 0; i < chatIds.length; i += chunkSize) {
        const slice = chatIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("zapi_messages")
          .select("id,chat_id,from_me,is_whisper,sent_by_user_id,created_at")
          .in("chat_id", slice)
          .order("created_at", { ascending: true })
          .limit(20000);
        if (error) throw error;
        out.push(...(data || []));
      }
      return out;
    },
  });

  // Available categories from tickets in period
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    (tickets as any[]).forEach((t) => { if (t.category) set.add(t.category); });
    return Array.from(set).sort();
  }, [tickets]);

  // Filtered datasets
  const filteredTickets = useMemo(() => {
    return (tickets as any[]).filter((t) => {
      if (sector !== "__all__" && (t.sector || "") !== sector) return false;
      if (category !== "__all__" && (t.category || "") !== category) return false;
      return true;
    });
  }, [tickets, sector, category]);

  const filteredChats = useMemo(() => {
    return (chats as any[]).filter((c) => {
      if (sector !== "__all__" && (c.sector_name || "") !== sector) return false;
      // Chats don't have category — when category filter is set, skip chats
      if (category !== "__all__") return false;
      return true;
    });
  }, [chats, sector, category]);

  const filteredChatIds = useMemo(
    () => new Set(filteredChats.map((c: any) => c.id)),
    [filteredChats]
  );
  const filteredMessages = useMemo(
    () => (messages as any[]).filter((m) => filteredChatIds.has(m.chat_id)),
    [messages, filteredChatIds]
  );

  // Compute metrics
  const tmpr = useMemo(
    () => computeFirstResponseTimes(filteredChats as any, filteredMessages as any, operators as any),
    [filteredChats, filteredMessages, operators]
  );
  const idleness = useMemo(
    () => computeIdleness(filteredChats as any, filteredMessages as any, operators as any, idleThresholdMin * 60_000),
    [filteredChats, filteredMessages, operators, idleThresholdMin]
  );
  const productivity = useMemo(
    () => computeProductivity(source, filteredChats as any, filteredTickets as any, operators as any),
    [source, filteredChats, filteredTickets, operators]
  );
  const bottlenecks = useMemo(
    () => computeSectorBottlenecks(filteredTickets as any),
    [filteredTickets]
  );
  const plans = useMemo(
    () => suggestActions(idleness, tmpr, productivity),
    [idleness, tmpr, productivity]
  );

  const isLoading = ticketsLoading || chatsLoading || msgsLoading;

  const tmprChart = tmpr.slice(0, 15).map((r) => ({
    name: r.operatorName,
    minutes: +(r.avgMs / 60000).toFixed(2),
  }));
  const bottleneckChart = bottlenecks
    .filter((b) => b.tmaMs > 0)
    .slice(0, 10)
    .map((b) => ({ name: b.category, hours: +(b.tmaMs / 3600000).toFixed(2) }));

  const chartConfig: ChartConfig = {
    minutes: { label: "Minutos", color: "hsl(var(--chart-1))" },
    hours: { label: "Horas", color: "hsl(var(--chart-2))" },
  };

  async function registerPlan(plan: typeof plans[number]) {
    const { error } = await supabase.from("audit_logs").insert({
      action: "register_action_plan",
      entity_type: "operator_action_plan",
      entity_id: plan.operatorId,
      details: {
        operator_name: plan.operatorName,
        metrics: plan.metrics,
        actions: plan.actions,
        period: { from: dateFrom, to: dateTo },
        source,
      },
    } as any);
    if (error) toast.error("Erro ao registrar plano: " + error.message);
    else toast.success(`Plano de ação registrado para ${plan.operatorName}`);
  }

  return (
    <div className="space-y-4">
      {/* Filtros locais */}
      <Card>
        <CardContent className="pt-4 grid gap-3 md:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Origem dos dados</Label>
            <Select value={source} onValueChange={(v) => setSource(v as DataSource)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="chat">Chat</SelectItem>
                <SelectItem value="atendimento">Atendimento</SelectItem>
                <SelectItem value="ambos">Ambos (consolidado)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Setor</Label>
            <Select value={sector} onValueChange={setSector}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos os setores</SelectItem>
                {(sectors as any[]).map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Categoria de chamado</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {availableCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Limite de ociosidade (min)</Label>
            <Input
              type="number"
              min={1}
              max={120}
              value={idleThresholdMin}
              onChange={(e) => setIdleThresholdMin(Math.max(1, Number(e.target.value) || 10))}
            />
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando métricas...
        </div>
      ) : (
        <>
          {/* 1. Ranking TMPR */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" />
                Ranking de Operadores — Tempo Médio de Primeira Resposta (TMPR)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {tmprChart.length > 0 && (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={tmprChart} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>#</TableHead>
                    <TableHead>Operador</TableHead>
                    <TableHead>TMPR</TableHead>
                    <TableHead>Chats analisados</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tmpr.length === 0 ? (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  ) : tmpr.map((r, i) => (
                    <TableRow key={r.operatorId}>
                      <TableCell className="font-mono">{i + 1}</TableCell>
                      <TableCell>{r.operatorName}</TableCell>
                      <TableCell>{formatDuration(r.avgMs)}</TableCell>
                      <TableCell>{r.chatsAnalyzed}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 2. Ociosidade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Clock className="h-4 w-4 text-orange-500" />
                Análise de Ociosidade (espera &gt; {idleThresholdMin} min)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Chats atendidos</TableHead>
                    <TableHead>Chats ociosos</TableHead>
                    <TableHead>Taxa</TableHead>
                    <TableHead>Espera média</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {idleness.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  ) : idleness.map((r) => (
                    <TableRow key={r.operatorId}>
                      <TableCell>{r.operatorName}</TableCell>
                      <TableCell>{r.totalChats}</TableCell>
                      <TableCell>{r.idleChats}</TableCell>
                      <TableCell>
                        <Badge variant={r.idleRate > 0.3 ? "destructive" : r.idleRate > 0.1 ? "secondary" : "outline"}>
                          {formatPct(r.idleRate)}
                        </Badge>
                      </TableCell>
                      <TableCell>{formatDuration(r.avgIdleMs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 3. Produtividade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Produtividade — Volume Concluído & TMA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Volume concluído</TableHead>
                    <TableHead>TMA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {productivity.length === 0 ? (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  ) : productivity.map((r) => (
                    <TableRow key={r.operatorId}>
                      <TableCell>{r.operatorName}</TableCell>
                      <TableCell>{r.resolved}</TableCell>
                      <TableCell>{formatDuration(r.tmaMs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 4. Gargalos */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                Gargalos por Setor / Categoria
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {bottleneckChart.length > 0 && (
                <ChartContainer config={chartConfig} className="h-[280px] w-full">
                  <BarChart data={bottleneckChart} layout="vertical" margin={{ left: 120 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" tick={{ fontSize: 10 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={160} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 2, 2, 0]} />
                  </BarChart>
                </ChartContainer>
              )}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Setor</TableHead>
                    <TableHead>Categoria</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Em aberto</TableHead>
                    <TableHead>Finalizados</TableHead>
                    <TableHead>TMA</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bottlenecks.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  ) : bottlenecks.map((b, i) => (
                    <TableRow key={i}>
                      <TableCell>{b.sector}</TableCell>
                      <TableCell className="flex items-center gap-2">
                        {b.category}
                        {b.isBottleneck && <Badge variant="destructive">Gargalo</Badge>}
                      </TableCell>
                      <TableCell>{b.total}</TableCell>
                      <TableCell>{b.open}</TableCell>
                      <TableCell>{b.finalized}</TableCell>
                      <TableCell>{formatDuration(b.tmaMs)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 5. Planos de Ação */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Target className="h-4 w-4 text-primary" />
                Plano de Ação Individual — Top 3 com pior taxa de ociosidade
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3 md:grid-cols-3">
              {plans.length === 0 ? (
                <div className="col-span-full text-center text-muted-foreground py-6">
                  Sem dados suficientes para gerar planos.
                </div>
              ) : plans.map((p) => (
                <Card key={p.operatorId} className="border-primary/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{p.operatorName}</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-xs">
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant="destructive">Ociosidade {formatPct(p.metrics.idleRate)}</Badge>
                      <Badge variant="secondary">TMPR {formatDuration(p.metrics.tmprMs)}</Badge>
                      <Badge variant="secondary">TMA {formatDuration(p.metrics.tmaMs)}</Badge>
                    </div>
                    <ul className="space-y-2">
                      {p.actions.map((a, idx) => (
                        <li key={idx} className="flex gap-2">
                          <ListChecks className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <span>{a}</span>
                        </li>
                      ))}
                    </ul>
                    <Button size="sm" className="w-full" onClick={() => registerPlan(p)}>
                      Registrar plano
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
