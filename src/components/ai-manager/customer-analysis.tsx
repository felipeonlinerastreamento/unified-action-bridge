import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  Users, AlertTriangle, Sparkles, RefreshCw, TrendingDown, Bot, Bell, Loader2,
} from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";
import {
  generateAiManagerReport,
  getLatestAiManagerReport,
} from "@/lib/ai-manager.functions";

function riskBadge(risk: string) {
  if (risk === "alto") return <Badge variant="destructive">Alto</Badge>;
  if (risk === "medio") return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Médio</Badge>;
  return <Badge variant="secondary">Baixo</Badge>;
}

function severityBadge(s: string) {
  if (s === "critical") return <Badge variant="destructive">Crítico</Badge>;
  if (s === "warning") return <Badge className="bg-amber-500 text-white hover:bg-amber-500/90">Atenção</Badge>;
  return <Badge variant="secondary">Info</Badge>;
}

type Aggregate = {
  topCustomers: Array<{
    name: string; phone: string;
    ticketsLast30: number; ticketsLast60: number; ticketsLast90: number;
    reopened: number; avgCsat: number | null; lastInteraction: string | null; topCategory: string | null;
  }>;
  recurringCategories: Array<{ category: string; count: number }>;
  totalChats: number;
  totalTickets: number;
};

type AiPart = {
  alerts?: Array<{ severity: string; title: string; detail: string }>;
  opportunities?: Array<{ customer: string; description: string; potentialValue: string; confidence: number }>;
  insightsMarkdown?: string;
  executiveSummaryMarkdown?: string;
  commercialMapMarkdown?: string;
  customerRisks?: Array<{ name: string; insatisfactionScore: number; churnRisk: string; reason: string }>;
};

export function CustomerAnalysisView() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const fetchLatest = useServerFn(getLatestAiManagerReport);
  const generate = useServerFn(generateAiManagerReport);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-manager-report", "customers"],
    queryFn: () => fetchLatest({ data: { scope: "customers" } }),
  });

  const mutation = useMutation({
    mutationFn: () => generate({ data: { scope: "customers", period_days: period } }),
    onSuccess: () => {
      toast.success("Análise atualizada com dados reais do sistema.");
      queryClient.invalidateQueries({ queryKey: ["ai-manager-report", "customers"] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao gerar análise."),
  });

  const report = data?.report;
  const payload = (report?.payload as { aggregate: Aggregate; ai: AiPart } | undefined);
  const agg = payload?.aggregate;
  const ai = payload?.ai;

  const generatedAt = report?.generated_at ? new Date(report.generated_at) : null;

  return (
    <div className="space-y-4">
      {/* Header com controles */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium">Análise de Clientes</p>
            <p className="text-xs text-muted-foreground">
              {generatedAt
                ? `Última atualização: ${generatedAt.toLocaleString("pt-BR")} · janela de ${report?.period_days} dias`
                : "Nenhuma análise gerada ainda."}
            </p>
          </div>
          <Select value={String(period)} onValueChange={(v) => setPeriod(Number(v) as 7 | 30 | 90)}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Últimos 7 dias</SelectItem>
              <SelectItem value="30">Últimos 30 dias</SelectItem>
              <SelectItem value="90">Últimos 90 dias</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => mutation.mutate()} disabled={mutation.isPending}>
            {mutation.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
            {mutation.isPending ? "Analisando…" : "Gerar nova análise"}
          </Button>
        </CardContent>
      </Card>

      {isLoading && !report && (
        <Card><CardContent className="p-6 text-sm text-muted-foreground">Carregando…</CardContent></Card>
      )}

      {!isLoading && !report && (
        <Card>
          <CardContent className="p-8 text-center space-y-2">
            <Bot className="h-10 w-10 text-muted-foreground mx-auto" />
            <p className="font-medium">Nenhuma análise gerada ainda</p>
            <p className="text-sm text-muted-foreground">
              Clique em "Gerar nova análise" para que a IA processe os dados reais do seu sistema.
            </p>
          </CardContent>
        </Card>
      )}

      {report && agg && (
        <>
          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card><CardContent className="p-4 flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div><p className="text-2xl font-bold">{agg.topCustomers.length}</p><p className="text-xs text-muted-foreground">Clientes analisados</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <div><p className="text-2xl font-bold">{ai?.customerRisks?.filter((r) => r.churnRisk !== "baixo").length ?? 0}</p><p className="text-xs text-muted-foreground">Em risco</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <Sparkles className="h-8 w-8 text-amber-500" />
              <div><p className="text-2xl font-bold">{ai?.opportunities?.length ?? 0}</p><p className="text-xs text-muted-foreground">Oportunidades</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <TrendingDown className="h-8 w-8 text-emerald-500" />
              <div><p className="text-2xl font-bold">{agg.totalTickets}</p><p className="text-xs text-muted-foreground">Chamados período</p></div>
            </CardContent></Card>
          </div>

          {/* Alertas */}
          {ai?.alerts && ai.alerts.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-destructive" /> Alertas proativos da IA
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {ai.alerts.map((a, i) => (
                  <Alert key={i}>
                    <AlertTitle className="flex items-center gap-2">
                      {a.title} {severityBadge(a.severity)}
                    </AlertTitle>
                    <AlertDescription>{a.detail}</AlertDescription>
                  </Alert>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Top clientes */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Clientes com mais chamados</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-center">30d</TableHead>
                    <TableHead className="text-center">60d</TableHead>
                    <TableHead className="text-center">90d</TableHead>
                    <TableHead className="text-center">Reab.</TableHead>
                    <TableHead className="text-center">CSAT</TableHead>
                    <TableHead>Top categoria</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agg.topCustomers.slice(0, 15).map((c) => (
                    <TableRow key={c.phone}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-center">{c.ticketsLast30}</TableCell>
                      <TableCell className="text-center">{c.ticketsLast60}</TableCell>
                      <TableCell className="text-center">{c.ticketsLast90}</TableCell>
                      <TableCell className="text-center">{c.reopened}</TableCell>
                      <TableCell className="text-center">{c.avgCsat?.toFixed(1) ?? "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">{c.topCategory || "—"}</TableCell>
                    </TableRow>
                  ))}
                  {agg.topCustomers.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Recorrência + IA risks */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <RefreshCw className="h-4 w-4" /> Recorrência por categoria
                </CardTitle>
              </CardHeader>
              <CardContent>
                {agg.recurringCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem dados no período.</p>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={agg.recurringCategories} layout="vertical" margin={{ left: 8 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis type="number" />
                      <YAxis dataKey="category" type="category" width={140} tick={{ fontSize: 11 }} />
                      <Tooltip />
                      <Bar dataKey="count" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Risco de churn (IA)</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                {(ai?.customerRisks || []).map((r, i) => (
                  <div key={i} className="rounded-lg border p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-sm">{r.name}</p>
                      {riskBadge(r.churnRisk)}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{r.reason}</p>
                    <Progress value={r.insatisfactionScore} className="h-1.5 mt-2" />
                  </div>
                ))}
                {(!ai?.customerRisks || ai.customerRisks.length === 0) && (
                  <p className="text-sm text-muted-foreground">Sem riscos identificados pela IA.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Oportunidades */}
          {ai?.opportunities && ai.opportunities.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" /> Oportunidades de negócio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {ai.opportunities.map((o, i) => (
                  <div key={i} className="rounded-lg border p-3">
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
          )}

          {/* Insights + Resumo */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2"><Bot className="h-4 w-4 text-primary" /> Insights da IA</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{ai?.insightsMarkdown || "_Sem insights._"}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Resumo executivo</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{ai?.executiveSummaryMarkdown || "_Sem resumo._"}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          </div>

          {ai?.commercialMapMarkdown && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Mapa de oportunidades comerciais</CardTitle></CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <ReactMarkdown>{ai.commercialMapMarkdown}</ReactMarkdown>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
