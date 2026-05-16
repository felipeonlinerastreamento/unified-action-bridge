import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import ReactMarkdown from "react-markdown";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
  RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar,
  LineChart, Line,
} from "recharts";
import {
  Users2, Headphones, Star, RefreshCcw, Sparkles, GraduationCap, TrendingUp,
} from "lucide-react";
import {
  mockOperators, mockSectors, mockOperatorImprovementsMarkdown,
  mockTrainingRecommendations, mockForecast,
} from "@/lib/ai-manager-mock";

export function OperatorPerformanceView() {
  const totalAttendances = mockOperators.reduce((a, o) => a + o.attendances, 0);
  const avgTma = Math.round(mockOperators.reduce((a, o) => a + o.avgHandlingMinutes, 0) / mockOperators.length);
  const avgCsat = (mockOperators.reduce((a, o) => a + o.csat, 0) / mockOperators.length).toFixed(2);
  const reopened = mockOperators.reduce((a, o) => a + o.reopenedTickets, 0);

  return (
    <div className="space-y-4">
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

      {/* Operator bar chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Desempenho por operador</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={mockOperators}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="attendances" name="Atendimentos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="avgHandlingMinutes" name="TMA (min)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              <Bar dataKey="communicationScore" name="Comunicação" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sector radar + forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Comparativo de setores</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <RadarChart data={mockSectors.map((s) => ({
                sector: s.sector,
                CSAT: s.csat * 20,
                Resolução: s.resolutionRate,
                Comunicação: s.communicationScore,
                Eficiência: Math.max(0, 100 - s.avgHandlingMinutes * 3),
              }))}>
                <PolarGrid />
                <PolarAngleAxis dataKey="sector" />
                <PolarRadiusAxis angle={30} domain={[0, 100]} />
                <Radar name="CSAT" dataKey="CSAT" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
                <Radar name="Resolução" dataKey="Resolução" stroke="#10b981" fill="#10b981" fillOpacity={0.25} />
                <Radar name="Comunicação" dataKey="Comunicação" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.2} />
                <Legend />
                <Tooltip />
              </RadarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Previsão de volume (próx. 3 sem.)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={mockForecast}>
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
      </div>

      {/* Operators table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Operadores</CardTitle>
        </CardHeader>
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
                <TableHead className="text-center">Comunic.</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockOperators.map((o) => (
                <TableRow key={o.id}>
                  <TableCell className="font-medium">{o.name}</TableCell>
                  <TableCell><Badge variant="outline">{o.sector}</Badge></TableCell>
                  <TableCell className="text-center">{o.attendances}</TableCell>
                  <TableCell className="text-center">{o.avgHandlingMinutes} min</TableCell>
                  <TableCell className="text-center">{o.csat.toFixed(1)}</TableCell>
                  <TableCell className="text-center">{o.reopenedTickets}</TableCell>
                  <TableCell className="text-center">
                    <Badge variant={o.communicationScore >= 80 ? "default" : o.communicationScore >= 65 ? "secondary" : "destructive"}>
                      {o.communicationScore}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* AI Improvement suggestions */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-amber-500" /> Sugestões de Melhoria da IA
          </CardTitle>
          <Button variant="outline" size="sm" disabled>
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            Gerar nova análise
          </Button>
        </CardHeader>
        <CardContent>
          <div className="prose prose-sm max-w-none dark:prose-invert">
            <ReactMarkdown>{mockOperatorImprovementsMarkdown}</ReactMarkdown>
          </div>
        </CardContent>
      </Card>

      {/* Training recommendations */}
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
              {mockTrainingRecommendations.map((t, i) => (
                <TableRow key={i}>
                  <TableCell className="font-medium">{t.target}</TableCell>
                  <TableCell>
                    <Badge variant={t.scope === "setor" ? "default" : "secondary"}>{t.scope}</Badge>
                  </TableCell>
                  <TableCell>{t.topic}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{t.reason}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
