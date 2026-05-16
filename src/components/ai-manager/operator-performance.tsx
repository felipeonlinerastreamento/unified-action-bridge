import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from "recharts";
import {
  Users2, Headphones, Star, RefreshCcw, Sparkles, GraduationCap, TrendingUp, Bot, Loader2,
} from "lucide-react";
import {
  generateAiManagerReport,
  getLatestAiManagerReport,
} from "@/lib/ai-manager.functions";
import { ManagerInstructionsCard } from "./manager-instructions-card";

type Aggregate = {
  operators: Array<{
    id: string; name: string; sector: string | null;
    attendances: number; avgHandlingMinutes: number;
    csat: number | null; reopenedTickets: number;
  }>;
  sectors: Array<{
    sector: string; attendances: number; avgHandlingMinutes: number;
    csat: number | null; resolutionRate: number;
  }>;
  weeklyVolume: Array<{ label: string; actual: number }>;
};

type AiPart = {
  improvementsMarkdown?: string;
  trainingRecommendations?: Array<{ target: string; scope: string; topic: string; reason: string }>;
  communicationScores?: Array<{ operatorId: string; score: number; note: string }>;
  forecast?: Array<{ label: string; predicted: number }>;
};

export function OperatorPerformanceView() {
  const queryClient = useQueryClient();
  const [period, setPeriod] = useState<7 | 30 | 90>(30);
  const fetchLatest = useServerFn(getLatestAiManagerReport);
  const generate = useServerFn(generateAiManagerReport);

  const { data, isLoading } = useQuery({
    queryKey: ["ai-manager-report", "operators"],
    queryFn: () => fetchLatest({ data: { scope: "operators" } }),
  });

  const mutation = useMutation({
    mutationFn: () => generate({ data: { scope: "operators", period_days: period } }),
    onSuccess: () => {
      toast.success("Análise de operadores atualizada.");
      queryClient.invalidateQueries({ queryKey: ["ai-manager-report", "operators"] });
    },
    onError: (err: Error) => toast.error(err.message || "Falha ao gerar análise."),
  });

  const report = data?.report;
  const payload = (report?.payload as { aggregate: Aggregate; ai: AiPart } | undefined);
  const agg = payload?.aggregate;
  const ai = payload?.ai;
  const generatedAt = report?.generated_at ? new Date(report.generated_at) : null;

  const scoreById = new Map((ai?.communicationScores || []).map((s) => [s.operatorId, s.score]));

  const totalAttendances = agg ? agg.operators.reduce((a, o) => a + o.attendances, 0) : 0;
  const avgTma = agg && agg.operators.length > 0
    ? Math.round(agg.operators.reduce((a, o) => a + o.avgHandlingMinutes, 0) / agg.operators.length)
    : 0;
  const csatVals = agg ? agg.operators.map((o) => o.csat).filter((v): v is number => v != null) : [];
  const avgCsat = csatVals.length > 0 ? (csatVals.reduce((a, b) => a + b, 0) / csatVals.length).toFixed(2) : "—";
  const reopened = agg ? agg.operators.reduce((a, o) => a + o.reopenedTickets, 0) : 0;

  const forecastData = agg ? [
    ...agg.weeklyVolume,
    ...((ai?.forecast || []).map((f) => ({ label: f.label, predicted: f.predicted }))),
  ] : [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="flex-1 min-w-[200px]">
            <p className="text-sm font-medium">Performance de Operadores e Setores</p>
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
              <Headphones className="h-8 w-8 text-primary" />
              <div><p className="text-2xl font-bold">{totalAttendances}</p><p className="text-xs text-muted-foreground">Atendimentos</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <Users2 className="h-8 w-8 text-blue-500" />
              <div><p className="text-2xl font-bold">{avgTma} min</p><p className="text-xs text-muted-foreground">TMA médio</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <Star className="h-8 w-8 text-amber-500" />
              <div><p className="text-2xl font-bold">{avgCsat}</p><p className="text-xs text-muted-foreground">CSAT médio</p></div>
            </CardContent></Card>
            <Card><CardContent className="p-4 flex items-center gap-3">
              <RefreshCcw className="h-8 w-8 text-destructive" />
              <div><p className="text-2xl font-bold">{reopened}</p><p className="text-xs text-muted-foreground">Reaberturas</p></div>
            </CardContent></Card>
          </div>

          {/* Operadores bar */}
          {agg.operators.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-base">Desempenho por operador</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={agg.operators}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="attendances" name="Atendimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                    <Bar dataKey="avgHandlingMinutes" name="TMA (min)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Setor radar + forecast */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agg.sectors.length > 0 && (
              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Comparativo de setores</CardTitle></CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <RadarChart data={agg.sectors.map((s) => ({
                      sector: s.sector,
                      CSAT: (s.csat || 0) * 20,
                      Resolução: s.resolutionRate,
                      Eficiência: Math.max(0, 100 - s.avgHandlingMinutes * 3),
                    }))}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="sector" />
                      <PolarRadiusAxis angle={30} domain={[0, 100]} />
                      <Radar name="CSAT" dataKey="CSAT" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                      <Radar name="Resolução" dataKey="Resolução" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                      <Radar name="Eficiência" dataKey="Eficiência" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                      <Legend />
                      <Tooltip />
                    </RadarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}

            {forecastData.length > 0 && (
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" /> Volume e previsão (IA)
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ResponsiveContainer width="100%" height={280}>
                    <LineChart data={forecastData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" />
                      <YAxis />
                      <Tooltip />
                      <Legend />
                      <Line type="monotone" dataKey="actual" name="Realizado" stroke="hsl(var(--primary))" strokeWidth={2} />
                      <Line type="monotone" dataKey="predicted" name="Previsto (IA)" stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 4" />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Tabela */}
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-base">Operadores</CardTitle></CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Operador</TableHead>
                    <TableHead>Setor</TableHead>
                    <TableHead className="text-center">Atend.</TableHead>
                    <TableHead className="text-center">TMA</TableHead>
                    <TableHead className="text-center">CSAT</TableHead>
                    <TableHead className="text-center">Reab.</TableHead>
                    <TableHead className="text-center">Comunic. (IA)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {agg.operators.map((o) => {
                    const score = scoreById.get(o.id);
                    return (
                      <TableRow key={o.id}>
                        <TableCell className="font-medium">{o.name}</TableCell>
                        <TableCell>{o.sector ? <Badge variant="outline">{o.sector}</Badge> : "—"}</TableCell>
                        <TableCell className="text-center">{o.attendances}</TableCell>
                        <TableCell className="text-center">{o.avgHandlingMinutes} min</TableCell>
                        <TableCell className="text-center">{o.csat?.toFixed(1) ?? "—"}</TableCell>
                        <TableCell className="text-center">{o.reopenedTickets}</TableCell>
                        <TableCell className="text-center">
                          {score != null ? (
                            <Badge variant={score >= 80 ? "default" : score >= 65 ? "secondary" : "destructive"}>{score}</Badge>
                          ) : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {agg.operators.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Sugestões IA */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" /> Sugestões de Melhoria da IA
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm max-w-none dark:prose-invert">
                <ReactMarkdown>{ai?.improvementsMarkdown || "_Sem sugestões geradas._"}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          {/* Treinamentos */}
          {ai?.trainingRecommendations && ai.trainingRecommendations.length > 0 && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <GraduationCap className="h-4 w-4 text-primary" /> Recomendação de treinamentos
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Alvo</TableHead>
                      <TableHead>Escopo</TableHead>
                      <TableHead>Tema</TableHead>
                      <TableHead>Motivo</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ai.trainingRecommendations.map((t, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-medium">{t.target}</TableCell>
                        <TableCell><Badge variant={t.scope === "setor" ? "default" : "secondary"}>{t.scope}</Badge></TableCell>
                        <TableCell>{t.topic}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{t.reason}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
