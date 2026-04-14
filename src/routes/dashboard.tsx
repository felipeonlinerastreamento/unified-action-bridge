import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { supabase } from "@/integrations/supabase/client";
import {
  MessageSquare, Clock, CheckCircle, AlertTriangle, Package, Headphones,
  Users, BarChart3, TrendingUp, Activity, Monitor, Timer, AlertOctagon,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  component: DashboardPage,
});

function DashboardPage() {
  const { isAuthenticated, isLoading, hasRole } = useAuth();
  const isAdmin = hasRole("admin") || hasRole("gestor");

  // Tickets data
  const { data: ticketStats } = useQuery({
    queryKey: ["dashboard-ticket-stats"],
    queryFn: async () => {
      const { data: tickets } = await supabase
        .from("service_tickets")
        .select("id, status, created_at, closed_at, opened_by, company_id, contact_name, attendance_id");
      return tickets || [];
    },
    enabled: isAuthenticated,
    refetchInterval: 30000,
  });

  // Profiles for operator names
  const { data: profiles = [] } = useQuery({
    queryKey: ["dashboard-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, name");
      return data || [];
    },
    enabled: isAuthenticated && isAdmin,
  });

  // Inventory data
  const { data: inventoryStats } = useQuery({
    queryKey: ["dashboard-inventory"],
    queryFn: async () => {
      const { data: items } = await supabase
        .from("inventory_items")
        .select("id, status, name, category_id, linked_to");
      return items || [];
    },
    enabled: isAuthenticated,
  });

  // Inventory categories
  const { data: invCategories = [] } = useQuery({
    queryKey: ["dashboard-inv-categories"],
    queryFn: async () => {
      const { data } = await supabase.from("inventory_categories").select("id, name");
      return data || [];
    },
    enabled: isAuthenticated,
  });

  // Auto tickets (stock alerts)
  const { data: stockAlerts = [] } = useQuery({
    queryKey: ["dashboard-stock-alerts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auto_tickets")
        .select("*")
        .eq("status", "aberto")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: isAuthenticated,
  });

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!isAuthenticated) return null;

  const tickets = ticketStats || [];
  const inventory = inventoryStats || [];

  // Compute metrics
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const openTickets = tickets.filter((t) => t.status === "aberto");
  const inProgressTickets = tickets.filter((t) => t.status === "em_andamento");
  const closedToday = tickets.filter(
    (t) => t.status === "finalizado" && t.closed_at && new Date(t.closed_at) >= today
  );
  const allClosed = tickets.filter((t) => t.status === "finalizado" && t.closed_at);

  // Avg service time (minutes)
  const avgTime = allClosed.length > 0
    ? allClosed.reduce((acc, t) => {
        const start = new Date(t.created_at).getTime();
        const end = new Date(t.closed_at!).getTime();
        return acc + (end - start) / 60000;
      }, 0) / allClosed.length
    : 0;

  const formatDuration = (mins: number) => {
    if (mins < 1) return "< 1 min";
    if (mins < 60) return `${Math.round(mins)} min`;
    const h = Math.floor(mins / 60);
    const m = Math.round(mins % 60);
    return `${h}h ${m}m`;
  };

  // Operator stats
  const profileMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.name]));
  const operatorStats = getOperatorStats(tickets, profileMap);

  // Inventory stats
  const availableItems = inventory.filter((i) => i.status === "disponivel");
  const linkedItems = inventory.filter((i) => i.status === "vinculado");
  const catMap = Object.fromEntries(invCategories.map((c) => [c.id, c.name]));
  const inventoryByCategory = getInventoryByCategory(inventory, catMap);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground">Visão geral operacional</p>
        </div>

        {/* KPI Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Atendimentos Abertos"
            value={String(openTickets.length)}
            icon={MessageSquare}
            description={`${inProgressTickets.length} em andamento`}
            accent={openTickets.length > 0}
          />
          <KPICard
            title="Em Espera"
            value={String(openTickets.length)}
            icon={Clock}
            description="Aguardando atendente"
            accent={openTickets.length > 5}
          />
          <KPICard
            title="Finalizados Hoje"
            value={String(closedToday.length)}
            icon={CheckCircle}
            description="Concluídos nas últimas 24h"
          />
          <KPICard
            title="Tempo Médio"
            value={avgTime > 0 ? formatDuration(avgTime) : "—"}
            icon={Headphones}
            description="Média geral de atendimento"
          />
        </div>

        {/* Admin panels */}
        {isAdmin && (
          <Tabs defaultValue="atendimentos">
            <TabsList>
              <TabsTrigger value="atendimentos" className="gap-1">
                <BarChart3 className="h-4 w-4" /> Atendimentos
              </TabsTrigger>
              <TabsTrigger value="operadores" className="gap-1">
                <Users className="h-4 w-4" /> Operadores
              </TabsTrigger>
              <TabsTrigger value="equipamentos" className="gap-1">
                <Monitor className="h-4 w-4" /> Equipamentos
              </TabsTrigger>
            </TabsList>

            {/* Atendimentos Tab */}
            <TabsContent value="atendimentos" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Total de chamados" value={String(tickets.length)} icon={Activity} />
                <MetricCard label="Abertos" value={String(openTickets.length + inProgressTickets.length)} icon={MessageSquare} />
                <MetricCard label="Finalizados" value={String(allClosed.length)} icon={CheckCircle} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Distribuição por Status</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <StatusBar label="Aberto" count={openTickets.length} total={tickets.length} color="bg-amber-500" />
                    <StatusBar label="Em andamento" count={inProgressTickets.length} total={tickets.length} color="bg-blue-500" />
                    <StatusBar label="Finalizado" count={allClosed.length} total={tickets.length} color="bg-emerald-500" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Últimos Atendimentos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {tickets.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Nenhum atendimento registrado.</p>
                    ) : (
                      <div className="space-y-2 max-h-48 overflow-y-auto">
                        {tickets.slice(0, 8).map((t) => (
                          <div key={t.id} className="flex items-center justify-between text-sm">
                            <span className="truncate max-w-[60%]">{t.contact_name || t.attendance_id}</span>
                            <Badge variant={t.status === "finalizado" ? "secondary" : t.status === "em_andamento" ? "default" : "outline"} className="text-xs">
                              {t.status === "aberto" ? "Aberto" : t.status === "em_andamento" ? "Em andamento" : "Finalizado"}
                            </Badge>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Operadores Tab */}
            <TabsContent value="operadores" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Desempenho por Operador</CardTitle>
                  <CardDescription>Métricas baseadas nos atendimentos registrados</CardDescription>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Operador</TableHead>
                        <TableHead className="text-center">Abertos</TableHead>
                        <TableHead className="text-center">Finalizados</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                        <TableHead className="text-center">Tempo Médio</TableHead>
                        <TableHead className="text-center">Eficiência</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {operatorStats.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                            Nenhum dado de operador disponível.
                          </TableCell>
                        </TableRow>
                      ) : (
                        operatorStats.map((op) => (
                          <TableRow key={op.userId}>
                            <TableCell className="font-medium">{op.name}</TableCell>
                            <TableCell className="text-center">{op.open}</TableCell>
                            <TableCell className="text-center">{op.closed}</TableCell>
                            <TableCell className="text-center">{op.total}</TableCell>
                            <TableCell className="text-center">{op.avgTime > 0 ? formatDuration(op.avgTime) : "—"}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant={op.efficiency >= 80 ? "default" : op.efficiency >= 50 ? "secondary" : "outline"}>
                                {op.efficiency}%
                              </Badge>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {operatorStats.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <TrendingUp className="h-4 w-4" /> Operador Destaque
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {(() => {
                      const best = operatorStats.reduce((a, b) => a.efficiency > b.efficiency ? a : b);
                      return (
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-lg">
                            {best.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-semibold text-foreground">{best.name}</p>
                            <p className="text-sm text-muted-foreground">
                              {best.closed} finalizados · {best.efficiency}% eficiência · Média {formatDuration(best.avgTime)}
                            </p>
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Equipamentos Tab */}
            <TabsContent value="equipamentos" className="space-y-4 mt-4">
              <div className="grid gap-4 md:grid-cols-3">
                <MetricCard label="Total de Equipamentos" value={String(inventory.length)} icon={Package} />
                <MetricCard label="Disponíveis" value={String(availableItems.length)} icon={CheckCircle} />
                <MetricCard label="Vinculados" value={String(linkedItems.length)} icon={Monitor} />
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Equipamentos por Categoria</CardTitle>
                </CardHeader>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Categoria</TableHead>
                        <TableHead className="text-center">Disponíveis</TableHead>
                        <TableHead className="text-center">Vinculados</TableHead>
                        <TableHead className="text-center">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {inventoryByCategory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            Nenhum equipamento cadastrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        inventoryByCategory.map((cat) => (
                          <TableRow key={cat.categoryId}>
                            <TableCell className="font-medium">{cat.categoryName}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline">{cat.available}</Badge>
                            </TableCell>
                            <TableCell className="text-center">
                              <Badge variant="secondary">{cat.linked}</Badge>
                            </TableCell>
                            <TableCell className="text-center">{cat.total}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {stockAlerts.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-destructive" /> Alertas de Estoque Mínimo
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {stockAlerts.map((alert) => (
                        <div key={alert.id} className="flex items-center justify-between text-sm border-b border-border pb-2 last:border-0">
                          <span className="font-medium">{alert.item_name}</span>
                          <span className="text-muted-foreground">
                            Atual: <span className="text-destructive font-semibold">{alert.current_quantity}</span> / Mín: {alert.min_quantity}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        )}

        {/* Non-admin simple view */}
        {!isAdmin && (
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-destructive" />
                  Alertas de Estoque
                </CardTitle>
              </CardHeader>
              <CardContent>
                {stockAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum alerta ativo.</p>
                ) : (
                  <div className="space-y-1">
                    {stockAlerts.slice(0, 5).map((a) => (
                      <p key={a.id} className="text-sm">{a.item_name}: {a.current_quantity}/{a.min_quantity}</p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Package className="h-4 w-4" /> Estoque Resumo
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-4">
                  <div>
                    <p className="text-2xl font-bold text-foreground">{availableItems.length}</p>
                    <p className="text-xs text-muted-foreground">Disponíveis</p>
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-foreground">{linkedItems.length}</p>
                    <p className="text-xs text-muted-foreground">Vinculados</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}

// --- Helper components ---

function KPICard({ title, value, icon: Icon, description, accent }: {
  title: string; value: string; icon: any; description: string; accent?: boolean;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`h-4 w-4 ${accent ? "text-primary" : "text-muted-foreground"}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function MetricCard({ label, value, icon: Icon }: { label: string; value: string; icon: any }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold text-foreground">{value}</p>
          <p className="text-xs text-muted-foreground">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted-foreground">{count} ({pct}%)</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// --- Data helpers ---

interface OperatorStat {
  userId: string;
  name: string;
  open: number;
  closed: number;
  total: number;
  avgTime: number;
  efficiency: number;
}

function getOperatorStats(tickets: any[], profileMap: Record<string, string>): OperatorStat[] {
  const map: Record<string, { open: number; closed: number; totalTime: number; closedCount: number }> = {};

  for (const t of tickets) {
    const uid = t.opened_by;
    if (!uid) continue;
    if (!map[uid]) map[uid] = { open: 0, closed: 0, totalTime: 0, closedCount: 0 };

    if (t.status === "finalizado") {
      map[uid].closed++;
      if (t.closed_at) {
        const mins = (new Date(t.closed_at).getTime() - new Date(t.created_at).getTime()) / 60000;
        map[uid].totalTime += mins;
        map[uid].closedCount++;
      }
    } else {
      map[uid].open++;
    }
  }

  return Object.entries(map)
    .map(([userId, s]) => ({
      userId,
      name: profileMap[userId] || userId.slice(0, 8),
      open: s.open,
      closed: s.closed,
      total: s.open + s.closed,
      avgTime: s.closedCount > 0 ? s.totalTime / s.closedCount : 0,
      efficiency: (s.open + s.closed) > 0 ? Math.round((s.closed / (s.open + s.closed)) * 100) : 0,
    }))
    .sort((a, b) => b.efficiency - a.efficiency);
}

function getInventoryByCategory(items: any[], catMap: Record<string, string>) {
  const map: Record<string, { available: number; linked: number }> = {};

  for (const item of items) {
    const catId = item.category_id;
    if (!map[catId]) map[catId] = { available: 0, linked: 0 };
    if (item.status === "disponivel") map[catId].available++;
    else map[catId].linked++;
  }

  return Object.entries(map)
    .map(([categoryId, s]) => ({
      categoryId,
      categoryName: catMap[categoryId] || "Sem categoria",
      available: s.available,
      linked: s.linked,
      total: s.available + s.linked,
    }))
    .sort((a, b) => b.total - a.total);
}
