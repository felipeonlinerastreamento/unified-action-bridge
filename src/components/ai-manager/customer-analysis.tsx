import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import ReactMarkdown from "react-markdown";
import {
  Users, AlertTriangle, Sparkles, RefreshCw, TrendingDown, Bot, Bell,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  mockCustomers, mockOpportunities, mockRecurringProblems,
  mockCustomerInsightsMarkdown, mockProactiveAlerts, mockExecutiveSummaryMarkdown,
  mockCommercialMapMarkdown, mockSentimentHeatmap,
} from "@/lib/ai-manager-mock";

function riskBadge(risk: "baixo" | "medio" | "alto") {
  if (risk === "alto") return <Badge variant="destructive">Alto</Badge>;
  if (risk === "medio") return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Médio</Badge>;
  return <Badge variant="secondary">Baixo</Badge>;
}

function scoreColor(score: number) {
  if (score >= 70) return "text-destructive";
  if (score >= 50) return "text-amber-600";
  return "text-emerald-600";
}

function severityBadge(s: "info" | "warning" | "critical") {
  if (s === "critical") return <Badge variant="destructive">Crítico</Badge>;
  if (s === "warning") return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Atenção</Badge>;
  return <Badge variant="secondary">Info</Badge>;
}

export function CustomerAnalysisView() {
  const totalAnalyzed = mockCustomers.length;
  const atRisk = mockCustomers.filter((c) => c.churnRisk !== "baixo").length;
  const opportunities = mockOpportunities.length;
  const avgScore = Math.round(
    mockCustomers.reduce((acc, c) => acc + (100 - c.insatisfactionScore), 0) / mockCustomers.length
  );

  // Build heatmap matrix
  const days = Array.from(new Set(mockSentimentHeatmap.map((p) => p.day))).sort();
  const customers = Array.from(new Set(mockSentimentHeatmap.map((p) => p.customer)));
  const cell = (customer: string, day: string) =>
    mockSentimentHeatmap.find((p) => p.customer === customer && p.day === day)?.riskScore ?? 0;
  const heatColor = (v: number) => {
    if (v >= 75) return "bg-destructive/80";
    if (v >= 55) return "bg-amber-500/70";
    if (v >= 35) return "bg-yellow-300/70";
    return "bg-emerald-400/50";
  };

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="h-8 w-8 text-primary" />
          <div><p className="text-2xl font-bold">{totalAnalyzed}</p><p className="text-xs text-muted-foreground">Clientes analisados</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-8 w-8 text-destructive" />
          <div><p className="text-2xl font-bold">{atRisk}</p><p className="text-xs text-muted-foreground">Em risco de churn</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Sparkles className="h-8 w-8 text-amber-500" />
          <div><p className="text-2xl font-bold">{opportunities}</p><p className="text-xs text-muted-foreground">Oportunidades</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <TrendingDown className="h-8 w-8 text-emerald-500" />
          <div><p className="text-2xl font-bold">{avgScore}</p><p className="text-xs text-muted-foreground">Satisfação média</p></div>
        </CardContent></Card>
      </div>

      {/* Proactive Alerts */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bell className="h-4 w-4 text-destructive" /> Alertas proativos da IA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {mockProactiveAlerts.map((a) => (
            <Alert key={a.id}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <AlertTitle className="flex items-center gap-2">
                    {a.title} {severityBadge(a.severity)}
                  </AlertTitle>
                  <AlertDescription>{a.detail}</AlertDescription>
                </div>
              </div>
            </Alert>
          ))}
        </CardContent>
      </Card>

      {/* Customers at risk */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Clientes em alerta</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead className="text-center">30d</TableHead>
                <TableHead className="text-center">60d</TableHead>
                <TableHead className="text-center">90d</TableHead>
                <TableHead>Problema recorrente</TableHead>
                <TableHead className="text-center">Insatisfação</TableHead>
                <TableHead className="text-center">Risco</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCustomers
                .slice()
                .sort((a, b) => b.insatisfactionScore - a.insatisfactionScore)
                .map((c) => (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.name}</TableCell>
                    <TableCell className="text-center">{c.ticketsLast30}</TableCell>
                    <TableCell className="text-center">{c.ticketsLast60}</TableCell>
                    <TableCell className="text-center">{c.ticketsLast90}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{c.recurringIssue}</TableCell>
                    <TableCell className={`text-center font-bold ${scoreColor(c.insatisfactionScore)}`}>
                      {c.insatisfactionScore}
                    </TableCell>
                    <TableCell className="text-center">{riskBadge(c.churnRisk)}</TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Recurring problems + Opportunities */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <RefreshCw className="h-4 w-4" /> Recorrência de problemas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={mockRecurringProblems} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="problem" type="category" width={140} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> Oportunidades de negócio
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {mockOpportunities.map((o) => (
              <div key={o.id} className="rounded-lg border p-3">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-sm">{o.customer}</p>
                  <Badge variant="outline">{o.potentialValue}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-1">{o.description}</p>
                <div className="mt-2 flex items-center gap-2">
                  <Progress value={o.confidence} className="h-1.5 flex-1" />
                  <span className="text-xs text-muted-foreground">{o.confidence}%</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Sentiment heatmap */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mapa de sentimento (risco diário por cliente)</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="text-xs border-separate border-spacing-1">
            <thead>
              <tr>
                <th></th>
                {days.map((d) => (
                  <th key={d} className="font-normal text-muted-foreground">{d.slice(5)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.map((cust) => (
                <tr key={cust}>
                  <td className="pr-2 whitespace-nowrap font-medium">{cust}</td>
                  {days.map((d) => {
                    const v = cell(cust, d);
                    return (
                      <td key={d} title={`${cust} ${d}: ${v}`}
                          className={`w-5 h-5 rounded ${heatColor(v)}`}></td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* IA Insights + Executive Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Insights da IA</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{mockCustomerInsightsMarkdown}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Resumo executivo semanal</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose prose-sm max-w-none dark:prose-invert">
              <ReactMarkdown>{mockExecutiveSummaryMarkdown}</ReactMarkdown>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Mapa de oportunidades comerciais</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{mockCommercialMapMarkdown}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
