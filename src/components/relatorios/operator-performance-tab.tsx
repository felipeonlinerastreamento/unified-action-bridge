import { ChartFrame } from "./chart-frame";
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
  Volume2, CalendarClock, Star, Users,
} from "lucide-react";
import {
  computeFirstResponseTimes, computeIdleness, computeProductivity,
  computeSectorBottlenecks, suggestActions, formatDuration, formatPct,
  computeStartDelay, computeOpenSilence, computeClosingPattern,
  computeQuality, computeTeamDiagnostic,
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

  // CSAT responses in range
  const { data: csat = [] } = useQuery({
    queryKey: ["perf-csat", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("csat_responses")
        .select("operator_user_id,score")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .limit(10000);
      if (error) throw error;
      return data || [];
    },
  });

  // Open chats snapshot (status != finalizado) — para tempo sem interação atual
  const { data: openChats = [] } = useQuery({
    queryKey: ["perf-open-chats"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("zapi_chats")
        .select("id,assigned_to,sector_name,status,created_at,last_message_at")
        .neq("status", "finalizado")
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  // Open tickets snapshot
  const { data: openTickets = [] } = useQuery({
    queryKey: ["perf-open-tickets"],
    refetchInterval: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_tickets")
        .select("id,assigned_to,sector,category,status,created_at,closed_at")
        .neq("status", "finalizado")
        .limit(2000);
      if (error) throw error;
      return data || [];
    },
  });

  // Headcount por setor (operadores atribuídos)
  const { data: sectorHeadcountRows = [] } = useQuery({
    queryKey: ["perf-sector-headcount"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_sector_assignments")
        .select("user_id, sectors:sector_id(name)");
      if (error) throw error;
      return data || [];
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

  // === Novas métricas ===
  const startDelay = useMemo(
    () => computeStartDelay(filteredChats as any, filteredTickets as any, filteredMessages as any, operators as any),
    [filteredChats, filteredTickets, filteredMessages, operators]
  );

  const silence = useMemo(
    () => computeOpenSilence(
      (openChats as any[]).filter((c) => sector === "__all__" || (c.sector_name || "") === sector),
      (openTickets as any[]).filter((t) => sector === "__all__" || (t.sector || "") === sector),
      operators as any,
      idleThresholdMin * 60_000
    ),
    [openChats, openTickets, operators, idleThresholdMin, sector]
  );

  const closing = useMemo(
    () => computeClosingPattern(filteredChats as any, filteredTickets as any, null, 30),
    [filteredChats, filteredTickets]
  );

  const quality = useMemo(
    () => computeQuality(source, filteredChats as any, filteredTickets as any, csat as any, operators as any),
    [source, filteredChats, filteredTickets, csat, operators]
  );

  const diagnostic = useMemo(() => {
    const sectorTotals = new Map<string, number>();
    for (const t of filteredTickets as any[]) {
      if (t.status !== "finalizado") continue;
      const s = t.sector || "Sem setor";
      sectorTotals.set(s, (sectorTotals.get(s) || 0) + 1);
    }
    for (const c of filteredChats as any[]) {
      if (c.status !== "finalizado") continue;
      const s = c.sector_name || "Sem setor";
      sectorTotals.set(s, (sectorTotals.get(s) || 0) + 1);
    }
    const headcount = new Map<string, number>();
    for (const row of sectorHeadcountRows as any[]) {
      const name = row?.sectors?.name;
      if (!name) continue;
      headcount.set(name, (headcount.get(name) || 0) + 1);
    }
    return computeTeamDiagnostic(productivity, startDelay, silence, quality, operators as any, sectorTotals, headcount);
  }, [filteredTickets, filteredChats, sectorHeadcountRows, productivity, startDelay, silence, quality, operators]);

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
                <ChartFrame bare title="Ranking TMPR" data={tmprChart as any} filename="ranking-tmpr">
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={tmprChart} layout="vertical" margin={{ left: 80 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={120} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="minutes" fill="var(--color-minutes)" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ChartContainer>
                </ChartFrame>
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
                <ChartFrame bare title="Gargalos por setor/categoria" data={bottleneckChart as any} filename="gargalos">
                  <ChartContainer config={chartConfig} className="h-[280px] w-full">
                    <BarChart data={bottleneckChart} layout="vertical" margin={{ left: 120 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={160} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="hours" fill="var(--color-hours)" radius={[0, 2, 2, 0]} />
                    </BarChart>
                  </ChartContainer>
                </ChartFrame>
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

          {/* 6. Atraso & Silêncio */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-amber-600" />
                Atraso de Início & Silêncio em Abertos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Abertos parados (&gt; {idleThresholdMin} min)</p>
                  <p className="text-2xl font-bold">{silence.silentCount} <span className="text-xs text-muted-foreground font-normal">/ {silence.totalOpen}</span></p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Silêncio médio</p>
                  <p className="text-2xl font-bold">{formatDuration(silence.avgSilenceMs)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Silêncio p90</p>
                  <p className="text-2xl font-bold">{formatDuration(silence.p90SilenceMs)}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Atraso médio (1ª ação)</p>
                  <p className="text-2xl font-bold">
                    {startDelay.length ? formatDuration(startDelay.reduce((s, r) => s + r.avgMs, 0) / startDelay.length) : "—"}
                  </p>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="text-xs font-medium mb-2">Atraso de início por operador</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead>Médio</TableHead>
                        <TableHead>p90</TableHead>
                        <TableHead>Itens</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {startDelay.length === 0 ? (
                        <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                      ) : startDelay.map((r) => (
                        <TableRow key={r.operatorId}>
                          <TableCell>{r.operatorName}</TableCell>
                          <TableCell>{formatDuration(r.avgMs)}</TableCell>
                          <TableCell>{formatDuration(r.p90Ms)}</TableCell>
                          <TableCell>{r.itemsAnalyzed}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                <div>
                  <p className="text-xs font-medium mb-2">Silêncio em abertos por operador</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead>Parados</TableHead>
                        <TableHead>Silêncio médio</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {silence.byOperator.length === 0 ? (
                        <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                      ) : silence.byOperator.map((r) => (
                        <TableRow key={r.operatorId || "none"}>
                          <TableCell>{r.operatorName}</TableCell>
                          <TableCell>
                            <Badge variant={r.silentCount > 3 ? "destructive" : "secondary"}>{r.silentCount}</Badge>
                          </TableCell>
                          <TableCell>{formatDuration(r.avgSilenceMs)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              {silence.topSilent.length > 0 && (
                <div>
                  <p className="text-xs font-medium mb-2">Top 10 chamados mais silenciosos agora</p>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Setor</TableHead>
                        <TableHead>Operador</TableHead>
                        <TableHead>Parado há</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {silence.topSilent.slice(0, 10).map((it) => (
                        <TableRow key={it.kind + it.id}>
                          <TableCell><Badge variant="outline">{it.kind === "chat" ? "Chat" : "Atend."}</Badge></TableCell>
                          <TableCell>{it.sector || "—"}</TableCell>
                          <TableCell>{it.operatorName}</TableCell>
                          <TableCell className="font-medium">{formatDuration(it.silenceMs)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 7. Padrão de finalização */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-blue-500" />
                Padrão de Finalização (hora do dia)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total finalizado</p>
                  <p className="text-2xl font-bold">{closing.totalClosed}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">% nos últimos 30 min do expediente</p>
                  <p className="text-2xl font-bold">
                    <Badge variant={closing.lastWindowPct > 0.2 ? "destructive" : closing.lastWindowPct > 0.1 ? "secondary" : "outline"}>
                      {formatPct(closing.lastWindowPct)}
                    </Badge>
                  </p>
                </div>
              </div>
              <ChartFrame
                bare
                title="Fechamentos por hora"
                data={closing.buckets.map((b) => ({ Hora: `${b.hour.toString().padStart(2, "0")}h`, Quantidade: b.count })) as any}
                filename="fechamentos-por-hora"
              >
                <ChartContainer config={chartConfig} className="h-[240px] w-full">
                  <BarChart data={closing.buckets.map((b) => ({ name: `${b.hour.toString().padStart(2, "0")}h`, qtd: b.count }))}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="qtd" fill="hsl(var(--chart-3))" radius={[2, 2, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </ChartFrame>

            </CardContent>
          </Card>

          {/* 8. Qualidade */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Qualidade — CSAT & Reabertura
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Finalizados</TableHead>
                    <TableHead>Reabertos</TableHead>
                    <TableHead>Taxa reabertura</TableHead>
                    <TableHead>CSAT</TableHead>
                    <TableHead>Respostas</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {quality.length === 0 ? (
                    <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                  ) : quality.map((r) => (
                    <TableRow key={r.operatorId}>
                      <TableCell>{r.operatorName}</TableCell>
                      <TableCell>{r.resolved}</TableCell>
                      <TableCell>{r.reopened}</TableCell>
                      <TableCell>
                        <Badge variant={r.reopenRate > 0.15 ? "destructive" : r.reopenRate > 0.05 ? "secondary" : "outline"}>
                          {formatPct(r.reopenRate)}
                        </Badge>
                      </TableCell>
                      <TableCell>{r.csatCount > 0 ? r.csatAvg.toFixed(2) : "—"}</TableCell>
                      <TableCell>{r.csatCount}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* 9. Diagnóstico de Equipe */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                Diagnóstico de Equipe — “Preciso desta equipe?”
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Total resolvido no período</p>
                  <p className="text-2xl font-bold">{diagnostic.totalResolved}</p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Concentração top‑3</p>
                  <p className="text-2xl font-bold">
                    <Badge variant={diagnostic.top3Share > 0.7 ? "destructive" : "secondary"}>
                      {formatPct(diagnostic.top3Share)}
                    </Badge>
                  </p>
                  {diagnostic.top3Share > 0.7 && (
                    <p className="text-[10px] text-muted-foreground mt-1">Top‑3 fazem &gt; 70% do volume — possível overstaffing.</p>
                  )}
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground">Concentração top‑5</p>
                  <p className="text-2xl font-bold">{formatPct(diagnostic.top5Share)}</p>
                </div>
              </div>

              <div>
                <p className="text-xs font-medium mb-2">Rótulo por operador</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Operador</TableHead>
                      <TableHead>Resolvidos</TableHead>
                      <TableHead>Atraso médio</TableHead>
                      <TableHead>Parados agora</TableHead>
                      <TableHead>CSAT</TableHead>
                      <TableHead>Rótulo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostic.operators.length === 0 ? (
                      <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                    ) : diagnostic.operators.map((r) => {
                      const variant: "default" | "destructive" | "secondary" | "outline" =
                        r.label === "Alto desempenho" ? "default" :
                        r.label === "Sobrecarregado" ? "destructive" :
                        r.label === "Subutilizado" ? "secondary" :
                        r.label === "Atenção" ? "destructive" : "outline";
                      return (
                        <TableRow key={r.operatorId}>
                          <TableCell>{r.operatorName}</TableCell>
                          <TableCell>{r.resolved}</TableCell>
                          <TableCell>{r.startDelayMs ? formatDuration(r.startDelayMs) : "—"}</TableCell>
                          <TableCell>{r.silentOpen}</TableCell>
                          <TableCell>{r.csatAvg > 0 ? r.csatAvg.toFixed(2) : "—"}</TableCell>
                          <TableCell><Badge variant={variant}>{r.label}</Badge></TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>

              <div>
                <p className="text-xs font-medium mb-2">Throughput por setor (finalizados ÷ headcount)</p>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Setor</TableHead>
                      <TableHead>Finalizados</TableHead>
                      <TableHead>Headcount</TableHead>
                      <TableHead>Por operador</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {diagnostic.sectorThroughput.length === 0 ? (
                      <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Sem dados</TableCell></TableRow>
                    ) : diagnostic.sectorThroughput.map((r) => (
                      <TableRow key={r.sector}>
                        <TableCell>{r.sector}</TableCell>
                        <TableCell>{r.resolved}</TableCell>
                        <TableCell>{r.headcount || "—"}</TableCell>
                        <TableCell className="font-medium">{r.perHead > 0 ? r.perHead.toFixed(1) : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
