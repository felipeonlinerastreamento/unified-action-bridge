import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportFilters } from "@/components/relatorios/report-filters";
import { ReportKpiCard } from "@/components/relatorios/report-kpi-card";
import { exportToCSV, exportToPDF } from "@/components/relatorios/export-utils";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, PieChart, Pie, Cell,
  LineChart, Line, AreaChart, Area, ResponsiveContainer,
} from "recharts";
import {
  MessageSquare, Clock, Users, Building2, Package, TrendingUp,
  Loader2, BarChart3, PieChart as PieChartIcon, Activity, Bell,
} from "lucide-react";

export const Route = createFileRoute("/relatorios")({
  component: RelatoriosPage,
});

const COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
  "#6366f1", "#ec4899", "#14b8a6", "#f59e0b", "#8b5cf6",
];

function getDefaultDates() {
  const now = new Date();
  const from = new Date(now);
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: now.toISOString().slice(0, 10),
  };
}

function RelatoriosPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const defaults = getDefaultDates();
  const [dateFrom, setDateFrom] = useState(defaults.from);
  const [dateTo, setDateTo] = useState(defaults.to);
  const [period, setPeriod] = useState("30d");
  const [activeTab, setActiveTab] = useState("atendimentos");
  const [plateFilter, setPlateFilter] = useState("");
  const [protocolFilter, setProtocolFilter] = useState("");
  const [operatorFilter, setOperatorFilter] = useState("");

  // Operators list (profiles)
  const { data: operators = [] } = useQuery({
    queryKey: ["report-operators"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data || []).map((p: any) => ({ id: p.user_id, name: p.name || "Sem nome" }));
    },
  });

  // Fetch tickets
  const { data: rawTickets = [], isLoading: ticketsLoading } = useQuery({
    queryKey: ["report-tickets", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("service_tickets")
        .select("*, channels(name, platform), companies(name)")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Apply plate / protocol / operator filters
  const tickets = useMemo(() => {
    const p = plateFilter.trim().toUpperCase();
    const proto = protocolFilter.trim().toLowerCase();
    const op = operatorFilter.trim();
    return (rawTickets as any[]).filter((t) => {
      if (p && !(t.plate || "").toUpperCase().includes(p)) return false;
      if (proto && !(t.attendance_id || "").toLowerCase().includes(proto)) return false;
      if (op && t.assigned_to !== op) return false;
      return true;
    });
  }, [rawTickets, plateFilter, protocolFilter, operatorFilter]);

  // Fetch inventory
  const { data: inventoryItems = [] } = useQuery({
    queryKey: ["report-inventory"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_items")
        .select("*, inventory_categories(name)");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: inventoryMovements = [] } = useQuery({
    queryKey: ["report-movements", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("inventory_movements")
        .select("*, inventory_items(name, inventory_categories(name))")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch flow instances
  const { data: flowInstances = [] } = useQuery({
    queryKey: ["report-flow-instances", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("attendance_flow_instances")
        .select("*, service_flows(name)")
        .gte("started_at", `${dateFrom}T00:00:00`)
        .lte("started_at", `${dateTo}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch contacts
  const { data: contacts = [] } = useQuery({
    queryKey: ["report-contacts", dateFrom, dateTo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_contacts")
        .select("*, crm_categories(name), companies(name)")
        .gte("created_at", `${dateFrom}T00:00:00`)
        .lte("created_at", `${dateTo}T23:59:59`);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch companies
  const { data: companies = [] } = useQuery({
    queryKey: ["report-companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*");
      if (error) throw error;
      return data || [];
    },
  });

  // ============ COMPUTED DATA ============

  // Atendimentos por período (daily)
  const ticketsByDay = useMemo(() => {
    const map: Record<string, { date: string; aberto: number; em_andamento: number; finalizado: number }> = {};
    tickets.forEach((t: any) => {
      const day = t.created_at?.slice(0, 10) || "";
      if (!map[day]) map[day] = { date: day, aberto: 0, em_andamento: 0, finalizado: 0 };
      const s = t.status as string;
      if (s === "aberto") map[day].aberto++;
      else if (s === "em_andamento") map[day].em_andamento++;
      else if (s === "finalizado") map[day].finalizado++;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [tickets]);

  // Atendimentos por status
  const ticketsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t: any) => { map[t.status] = (map[t.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({ name: statusLabel(name), value }));
  }, [tickets]);

  // Volume por canal
  const ticketsByChannel = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t: any) => {
      const ch = (t.channels as any)?.name || "Sem canal";
      map[ch] = (map[ch] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [tickets]);

  // Volume por empresa
  const ticketsByCompany = useMemo(() => {
    const map: Record<string, number> = {};
    tickets.forEach((t: any) => {
      const c = (t.companies as any)?.name || "Sem empresa";
      map[c] = (map[c] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 15);
  }, [tickets]);

  // Horários de pico
  const ticketsByHour = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, i) => ({ hour: `${i.toString().padStart(2, "0")}:00`, count: 0 }));
    tickets.forEach((t: any) => {
      const h = new Date(t.created_at).getHours();
      hours[h].count++;
    });
    return hours;
  }, [tickets]);

  // Inventory by status
  const inventoryByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryItems.forEach((i: any) => { map[i.status] = (map[i.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({
      name: name === "disponivel" ? "Disponível" : "Vinculado", value,
    }));
  }, [inventoryItems]);

  // Inventory by category
  const inventoryByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    inventoryItems.forEach((i: any) => {
      const cat = (i.inventory_categories as any)?.name || "Sem categoria";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [inventoryItems]);

  // Movements by day
  const movementsByDay = useMemo(() => {
    const map: Record<string, { date: string; entrada: number; saida: number }> = {};
    inventoryMovements.forEach((m: any) => {
      const day = m.created_at?.slice(0, 10) || "";
      if (!map[day]) map[day] = { date: day, entrada: 0, saida: 0 };
      if (m.type === "entrada") map[day].entrada += m.quantity;
      else map[day].saida += m.quantity;
    });
    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date));
  }, [inventoryMovements]);

  // Flows by status
  const flowsByStatus = useMemo(() => {
    const map: Record<string, number> = {};
    flowInstances.forEach((f: any) => { map[f.status] = (map[f.status] || 0) + 1; });
    return Object.entries(map).map(([name, value]) => ({
      name: name === "em_andamento" ? "Em andamento" : name === "pausado" ? "Pausado" : "Finalizado",
      value,
    }));
  }, [flowInstances]);

  // Flows by type
  const flowsByType = useMemo(() => {
    const map: Record<string, number> = {};
    flowInstances.forEach((f: any) => {
      const n = (f.service_flows as any)?.name || "Sem fluxo";
      map[n] = (map[n] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [flowInstances]);

  // Contacts by category
  const contactsByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    contacts.forEach((c: any) => {
      const cat = (c.crm_categories as any)?.name || "Sem categoria";
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [contacts]);

  const handleExport = (format: "csv" | "xlsx" | "pdf") => {
    if (format === "pdf") {
      exportToPDF("report-content", `relatorio-${activeTab}`);
      return;
    }
    let data: Record<string, unknown>[] = [];
    if (activeTab === "atendimentos") {
      data = tickets.map((t: any) => ({
        ID: t.attendance_id, Status: t.status, Empresa: (t.companies as any)?.name || "",
        Canal: (t.channels as any)?.name || "", Contato: t.contact_name || "",
        Telefone: t.contact_phone || "", Placa: t.plate || "",
        Criado: t.created_at, Fechado: t.closed_at || "",
      }));
    } else if (activeTab === "estoque") {
      data = inventoryItems.map((i: any) => ({
        Nome: i.name, Modelo: i.model || "", Serial: i.serial_number || "",
        Status: i.status, Categoria: (i.inventory_categories as any)?.name || "",
        Vinculado: i.linked_to || "",
      }));
    } else if (activeTab === "contatos") {
      data = contacts.map((c: any) => ({
        Nome: c.name, Telefone: c.phone, Email: c.email || "",
        Empresa: (c.companies as any)?.name || "", Categoria: (c.crm_categories as any)?.name || "",
      }));
    }
    exportToCSV(data, `relatorio-${activeTab}`);
  };

  if (authLoading || !isAuthenticated) return null;

  const isLoading = ticketsLoading;

  const chartConfigBar: ChartConfig = {
    aberto: { label: "Aberto", color: "hsl(var(--chart-1))" },
    em_andamento: { label: "Em andamento", color: "hsl(var(--chart-2))" },
    finalizado: { label: "Finalizado", color: "hsl(var(--chart-3))" },
  };

  const chartConfigMovements: ChartConfig = {
    entrada: { label: "Entrada", color: "hsl(var(--chart-1))" },
    saida: { label: "Saída", color: "hsl(var(--chart-4))" },
  };

  return (
    <AppLayout>
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-6 w-6" /> Relatórios
          </h1>
          <p className="text-sm text-muted-foreground">Dashboards, gráficos e exportação de dados gerenciais</p>
        </div>

        <ReportFilters
          dateFrom={dateFrom} dateTo={dateTo}
          onDateFromChange={setDateFrom} onDateToChange={setDateTo}
          period={period} onPeriodChange={setPeriod}
          onExport={handleExport}
          plate={plateFilter}
          onPlateChange={setPlateFilter}
          protocol={protocolFilter}
          onProtocolChange={setProtocolFilter}
          operatorId={operatorFilter}
          onOperatorChange={setOperatorFilter}
          operators={operators}
        />

        <div id="report-content">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="atendimentos" className="gap-1 text-xs">
                <MessageSquare className="h-3.5 w-3.5" /> Atendimentos
              </TabsTrigger>
              <TabsTrigger value="horarios" className="gap-1 text-xs">
                <Clock className="h-3.5 w-3.5" /> Horários
              </TabsTrigger>
              <TabsTrigger value="estoque" className="gap-1 text-xs">
                <Package className="h-3.5 w-3.5" /> Estoque
              </TabsTrigger>
              <TabsTrigger value="fluxos" className="gap-1 text-xs">
                <Activity className="h-3.5 w-3.5" /> Fluxos
              </TabsTrigger>
              <TabsTrigger value="contatos" className="gap-1 text-xs">
                <Users className="h-3.5 w-3.5" /> CRM / Contatos
              </TabsTrigger>
              <TabsTrigger value="notificacoes" className="gap-1 text-xs">
                <Bell className="h-3.5 w-3.5" /> Notificações
              </TabsTrigger>
            </TabsList>

            {/* ========== ATENDIMENTOS ========== */}
            <TabsContent value="atendimentos" className="space-y-4">
              {isLoading ? <LoadingState /> : (
                <>
                  {plateFilter && (
                    <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs flex items-center justify-between">
                      <span>
                        Filtrando por placa: <strong className="font-mono">{plateFilter.toUpperCase()}</strong> — {tickets.length} atendimento(s) encontrado(s)
                      </span>
                      <button
                        onClick={() => setPlateFilter("")}
                        className="text-primary hover:underline"
                      >Limpar filtro</button>
                    </div>
                  )}
                  <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                    <ReportKpiCard title="Total de Atendimentos" value={tickets.length} icon={MessageSquare} subtitle={`${dateFrom} a ${dateTo}`} />
                    <ReportKpiCard title="Abertos" value={tickets.filter((t: any) => t.status === "aberto").length} icon={Clock} trend={0} trendLabel="no período" />
                    <ReportKpiCard title="Em Andamento" value={tickets.filter((t: any) => t.status === "em_andamento").length} icon={Activity} />
                    <ReportKpiCard title="Finalizados" value={tickets.filter((t: any) => t.status === "finalizado").length} icon={TrendingUp} />
                  </div>

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Atendimentos por Dia</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {ticketsByDay.length > 0 ? (
                          <ChartContainer config={chartConfigBar} className="h-[280px] w-full">
                            <BarChart data={ticketsByDay}>
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                              <YAxis tick={{ fontSize: 10 }} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              
                              <Bar dataKey="aberto" fill="var(--color-aberto)" radius={[2, 2, 0, 0]} />
                              <Bar dataKey="em_andamento" fill="var(--color-em_andamento)" radius={[2, 2, 0, 0]} />
                              <Bar dataKey="finalizado" fill="var(--color-finalizado)" radius={[2, 2, 0, 0]} />
                            </BarChart>
                          </ChartContainer>
                        ) : <EmptyChart />}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Distribuição por Status</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {ticketsByStatus.length > 0 ? (
                          <ChartContainer config={{}} className="h-[280px] w-full">
                            <PieChart>
                              <Pie data={ticketsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                                {ticketsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                          </ChartContainer>
                        ) : <EmptyChart />}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Volume por Canal</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {ticketsByChannel.length > 0 ? (
                          <ChartContainer config={{}} className="h-[280px] w-full">
                            <PieChart>
                              <Pie data={ticketsByChannel} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} label>
                                {ticketsByChannel.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                              </Pie>
                              <ChartTooltip content={<ChartTooltipContent />} />
                            </PieChart>
                          </ChartContainer>
                        ) : <EmptyChart />}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">Top Empresas por Volume</CardTitle>
                      </CardHeader>
                      <CardContent>
                        {ticketsByCompany.length > 0 ? (
                          <ChartContainer config={{ value: { label: "Atendimentos", color: "hsl(var(--chart-1))" } }} className="h-[280px] w-full">
                            <BarChart data={ticketsByCompany} layout="vertical">
                              <CartesianGrid strokeDasharray="3 3" />
                              <XAxis type="number" tick={{ fontSize: 10 }} />
                              <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={120} />
                              <ChartTooltip content={<ChartTooltipContent />} />
                              <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                            </BarChart>
                          </ChartContainer>
                        ) : <EmptyChart />}
                      </CardContent>
                    </Card>
                  </div>

                  {/* Tabela detalhada */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">Detalhamento de Atendimentos</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="max-h-[400px] overflow-auto">
                        <Table>
                          <TableHeader>
                            <TableRow>
                              <TableHead className="text-xs">ID</TableHead>
                              <TableHead className="text-xs">Contato</TableHead>
                              <TableHead className="text-xs">Empresa</TableHead>
                              <TableHead className="text-xs">Canal</TableHead>
                              <TableHead className="text-xs">Placa</TableHead>
                              <TableHead className="text-xs">Status</TableHead>
                              <TableHead className="text-xs">Data</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {tickets.slice(0, 50).map((t: any) => (
                              <TableRow key={t.id}>
                                <TableCell className="text-xs font-mono">{t.attendance_id?.slice(0, 8)}</TableCell>
                                <TableCell className="text-xs">{t.contact_name || "—"}</TableCell>
                                <TableCell className="text-xs">{(t.companies as any)?.name || "—"}</TableCell>
                                <TableCell className="text-xs">{(t.channels as any)?.name || "—"}</TableCell>
                                <TableCell className="text-xs font-mono">{t.plate || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant={t.status === "finalizado" ? "default" : "secondary"} className="text-[10px]">
                                    {statusLabel(t.status)}
                                  </Badge>
                                </TableCell>
                                <TableCell className="text-xs">{new Date(t.created_at).toLocaleDateString("pt-BR")}</TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </TabsContent>

            {/* ========== HORÁRIOS DE PICO ========== */}
            <TabsContent value="horarios" className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <ReportKpiCard title="Horário de Pico" value={getTopHour(ticketsByHour)} icon={Clock} subtitle="Maior volume" />
                <ReportKpiCard title="Horário mais calmo" value={getLowestHour(ticketsByHour)} icon={Clock} subtitle="Menor volume" />
                <ReportKpiCard title="Média/hora" value={(tickets.length / 24).toFixed(1)} icon={Activity} />
                <ReportKpiCard title="Total no Período" value={tickets.length} icon={MessageSquare} />
              </div>
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Distribuição por Hora do Dia</CardTitle></CardHeader>
                <CardContent>
                  {tickets.length > 0 ? (
                    <ChartContainer config={{ count: { label: "Atendimentos", color: "hsl(var(--chart-1))" } }} className="h-[320px] w-full">
                      <AreaChart data={ticketsByHour}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="hour" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Area type="monotone" dataKey="count" fill="hsl(var(--chart-1))" fillOpacity={0.3} stroke="hsl(var(--chart-1))" strokeWidth={2} />
                      </AreaChart>
                    </ChartContainer>
                  ) : <EmptyChart />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhamento por Hora</CardTitle></CardHeader>
                <CardContent>
                  <div className="grid grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                    {ticketsByHour.map((h) => {
                      const max = Math.max(...ticketsByHour.map((x) => x.count), 1);
                      const intensity = h.count / max;
                      return (
                        <div key={h.hour} className="text-center p-2 rounded-md border" style={{ backgroundColor: `hsl(var(--chart-1) / ${0.1 + intensity * 0.5})` }}>
                          <p className="text-xs font-medium">{h.hour}</p>
                          <p className="text-lg font-bold">{h.count}</p>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ========== ESTOQUE ========== */}
            <TabsContent value="estoque" className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <ReportKpiCard title="Total de Itens" value={inventoryItems.length} icon={Package} />
                <ReportKpiCard title="Disponíveis" value={inventoryItems.filter((i: any) => i.status === "disponivel").length} icon={Package} />
                <ReportKpiCard title="Vinculados" value={inventoryItems.filter((i: any) => i.status === "vinculado").length} icon={Building2} />
                <ReportKpiCard title="Movimentações" value={inventoryMovements.length} icon={Activity} subtitle="no período" />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Status do Estoque</CardTitle></CardHeader>
                  <CardContent>
                    {inventoryByStatus.length > 0 ? (
                      <ChartContainer config={{}} className="h-[280px] w-full">
                        <PieChart>
                          <Pie data={inventoryByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                            {inventoryByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : <EmptyChart />}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Itens por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    {inventoryByCategory.length > 0 ? (
                      <ChartContainer config={{ value: { label: "Itens", color: "hsl(var(--chart-2))" } }} className="h-[280px] w-full">
                        <BarChart data={inventoryByCategory}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="hsl(var(--chart-2))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : <EmptyChart />}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Movimentações por Dia</CardTitle></CardHeader>
                <CardContent>
                  {movementsByDay.length > 0 ? (
                    <ChartContainer config={chartConfigMovements} className="h-[280px] w-full">
                      <BarChart data={movementsByDay}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                        <YAxis tick={{ fontSize: 10 }} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        
                        <Bar dataKey="entrada" fill="var(--color-entrada)" radius={[2, 2, 0, 0]} />
                        <Bar dataKey="saida" fill="var(--color-saida)" radius={[2, 2, 0, 0]} />
                      </BarChart>
                    </ChartContainer>
                  ) : <EmptyChart />}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Detalhamento de Movimentações</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Item</TableHead>
                          <TableHead className="text-xs">Tipo</TableHead>
                          <TableHead className="text-xs">Qtd</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                          <TableHead className="text-xs">Obs</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {inventoryMovements.slice(0, 50).map((m: any) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-xs">{(m.inventory_items as any)?.name || "—"}</TableCell>
                            <TableCell>
                              <Badge variant={m.type === "entrada" ? "default" : "secondary"} className="text-[10px]">
                                {m.type === "entrada" ? "Entrada" : "Saída"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs">{m.quantity}</TableCell>
                            <TableCell className="text-xs">{new Date(m.created_at).toLocaleDateString("pt-BR")}</TableCell>
                            <TableCell className="text-xs max-w-[200px] truncate">{m.notes || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ========== FLUXOS ========== */}
            <TabsContent value="fluxos" className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <ReportKpiCard title="Total de Instâncias" value={flowInstances.length} icon={Activity} />
                <ReportKpiCard title="Em Andamento" value={flowInstances.filter((f: any) => f.status === "em_andamento").length} icon={Clock} />
                <ReportKpiCard title="Finalizados" value={flowInstances.filter((f: any) => f.status === "finalizado").length} icon={TrendingUp} />
                <ReportKpiCard title="Pausados" value={flowInstances.filter((f: any) => f.status === "pausado").length} icon={Activity} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Status dos Fluxos</CardTitle></CardHeader>
                  <CardContent>
                    {flowsByStatus.length > 0 ? (
                      <ChartContainer config={{}} className="h-[280px] w-full">
                        <PieChart>
                          <Pie data={flowsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                            {flowsByStatus.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : <EmptyChart />}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Volume por Tipo de Fluxo</CardTitle></CardHeader>
                  <CardContent>
                    {flowsByType.length > 0 ? (
                      <ChartContainer config={{ value: { label: "Instâncias", color: "hsl(var(--chart-3))" } }} className="h-[280px] w-full">
                        <BarChart data={flowsByType}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="hsl(var(--chart-3))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : <EmptyChart />}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* ========== CRM / CONTATOS ========== */}
            <TabsContent value="contatos" className="space-y-4">
              <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
                <ReportKpiCard title="Contatos no Período" value={contacts.length} icon={Users} />
                <ReportKpiCard title="Total de Empresas" value={companies.length} icon={Building2} />
                <ReportKpiCard title="Categorias" value={contactsByCategory.length} icon={PieChartIcon} />
                <ReportKpiCard title="Com E-mail" value={contacts.filter((c: any) => c.email).length} icon={Users} />
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Contatos por Categoria</CardTitle></CardHeader>
                  <CardContent>
                    {contactsByCategory.length > 0 ? (
                      <ChartContainer config={{}} className="h-[280px] w-full">
                        <PieChart>
                          <Pie data={contactsByCategory} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={100} label>
                            {contactsByCategory.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                          </Pie>
                          <ChartTooltip content={<ChartTooltipContent />} />
                        </PieChart>
                      </ChartContainer>
                    ) : <EmptyChart />}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-sm">Contatos por Empresa</CardTitle></CardHeader>
                  <CardContent>
                    {contacts.length > 0 ? (
                      <ChartContainer config={{ value: { label: "Contatos", color: "hsl(var(--chart-5))" } }} className="h-[280px] w-full">
                        <BarChart data={(() => {
                          const map: Record<string, number> = {};
                          contacts.forEach((c: any) => {
                            const co = (c.companies as any)?.name || "Sem empresa";
                            map[co] = (map[co] || 0) + 1;
                          });
                          return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);
                        })()}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="name" tick={{ fontSize: 9 }} />
                          <YAxis tick={{ fontSize: 10 }} />
                          <ChartTooltip content={<ChartTooltipContent />} />
                          <Bar dataKey="value" fill="hsl(var(--chart-5))" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ChartContainer>
                    ) : <EmptyChart />}
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-sm">Lista de Contatos</CardTitle></CardHeader>
                <CardContent>
                  <div className="max-h-[300px] overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="text-xs">Nome</TableHead>
                          <TableHead className="text-xs">Telefone</TableHead>
                          <TableHead className="text-xs">E-mail</TableHead>
                          <TableHead className="text-xs">Empresa</TableHead>
                          <TableHead className="text-xs">Categoria</TableHead>
                          <TableHead className="text-xs">Data</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {contacts.slice(0, 50).map((c: any) => (
                          <TableRow key={c.id}>
                            <TableCell className="text-xs">{c.name}</TableCell>
                            <TableCell className="text-xs">{c.phone}</TableCell>
                            <TableCell className="text-xs">{c.email || "—"}</TableCell>
                            <TableCell className="text-xs">{(c.companies as any)?.name || "—"}</TableCell>
                            <TableCell className="text-xs">{(c.crm_categories as any)?.name || "—"}</TableCell>
                            <TableCell className="text-xs">{new Date(c.created_at).toLocaleDateString("pt-BR")}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notificacoes" className="space-y-4">
              <NotificationsReadReport dateFrom={dateFrom} dateTo={dateTo} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppLayout>
  );
}

// Helpers
function statusLabel(s: string) {
  if (s === "aberto") return "Aberto";
  if (s === "em_andamento") return "Em andamento";
  if (s === "finalizado") return "Finalizado";
  return s;
}

function getTopHour(data: { hour: string; count: number }[]) {
  const top = data.reduce((a, b) => (a.count > b.count ? a : b), { hour: "—", count: 0 });
  return top.hour;
}

function getLowestHour(data: { hour: string; count: number }[]) {
  const filtered = data.filter((h) => h.count > 0);
  if (!filtered.length) return "—";
  return filtered.reduce((a, b) => (a.count < b.count ? a : b)).hour;
}

function LoadingState() {
  return (
    <div className="flex justify-center items-center py-16">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
      Sem dados para o período selecionado
    </div>
  );
}
