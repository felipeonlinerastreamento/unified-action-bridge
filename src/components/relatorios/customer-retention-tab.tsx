import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "./report-kpi-card";
import { ChartFrame } from "./chart-frame";
import { exportToCSV } from "./export-utils";
import {
  Loader2, Users, UserPlus, UserMinus, RefreshCw, TrendingDown,
  Car, Award, Download, Snowflake,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  PieChart, Pie, Cell,
} from "recharts";

interface Props {
  dateFrom: string;
  dateTo: string;
}

// Janela (em dias) para considerar um cliente perdido
const JANELA_PERDIDO_DIAS = 60;
// Janela (em dias) para considerar um cliente novo
const JANELA_NOVO_DIAS = 30;

type Classificacao = "novo" | "recorrente" | "perdido";

interface ClienteAgg {
  cliente: string;
  total: number;
  primeiro: number; // timestamp do primeiro atendimento
  ultimo: number; // timestamp do último atendimento
  d30: number;
  d60: number; // 31 a 60 dias
  d90: number; // 61 a 90 dias
  placas: Set<string>;
  placasRecentes: Set<string>; // placas com serviço nos últimos 90 dias
  classificacao: Classificacao;
}

const PIE_COLORS = ["#22c55e", "#0ea5e9", "#ef4444"];
const ABC_COLORS: Record<string, string> = { A: "#22c55e", B: "#f59e0b", C: "#94a3b8" };

export function CustomerRetentionTab({ dateFrom, dateTo }: Props) {
  const [classeAberta, setClasseAberta] = useState<"A" | "B" | "C" | null>(null);
  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["report-customer-retention", dateFrom, dateTo],
    queryFn: async () => {
      const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toIso = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("service_tickets")
        .select("id, plate, status, created_at, contact_name, companies:company_id(name)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  const now = Date.now();
  const dia = 1000 * 60 * 60 * 24;

  const clientes = useMemo<ClienteAgg[]>(() => {
    const map = new Map<string, ClienteAgg>();
    for (const t of tickets) {
      const cliente = (t.companies?.name || t.contact_name || "—").trim() || "—";
      const ts = new Date(t.created_at).getTime();
      if (!isFinite(ts)) continue;
      const idade = (now - ts) / dia;
      const placa = (t.plate || "").toUpperCase().trim();

      const e =
        map.get(cliente) ||
        ({
          cliente,
          total: 0,
          primeiro: ts,
          ultimo: ts,
          d30: 0,
          d60: 0,
          d90: 0,
          placas: new Set<string>(),
          placasRecentes: new Set<string>(),
          classificacao: "recorrente",
        } as ClienteAgg);

      e.total++;
      if (ts < e.primeiro) e.primeiro = ts;
      if (ts > e.ultimo) e.ultimo = ts;
      if (idade <= 30) e.d30++;
      else if (idade <= 60) e.d60++;
      else if (idade <= 90) e.d90++;

      if (placa && placa !== "—") {
        e.placas.add(placa);
        if (idade <= 90) e.placasRecentes.add(placa);
      }

      map.set(cliente, e);
    }

    // Classifica cada cliente
    for (const e of map.values()) {
      const diasSemContato = (now - e.ultimo) / dia;
      const diasDesdePrimeiro = (now - e.primeiro) / dia;
      if (diasSemContato > JANELA_PERDIDO_DIAS) {
        e.classificacao = "perdido";
      } else if (diasDesdePrimeiro <= JANELA_NOVO_DIAS) {
        e.classificacao = "novo";
      } else {
        e.classificacao = "recorrente";
      }
    }

    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [tickets, now, dia]);

  // ===== Clientes esfriando: queda de volume 0-30d vs 31-60d =====
  const esfriando = useMemo(() => {
    return clientes
      .filter((c) => c.d60 > 0 && c.d30 < c.d60)
      .map((c) => ({
        cliente: c.cliente,
        d30: c.d30,
        d60: c.d60,
        d90: c.d90,
        queda: c.d60 > 0 ? Math.round(((c.d60 - c.d30) / c.d60) * 100) : 0,
        zerou: c.d30 === 0,
      }))
      .sort((a, b) => b.queda - a.queda || b.d60 - a.d60);
  }, [clientes]);

  // ===== Curva ABC =====
  const abc = useMemo(() => {
    const totalGeral = clientes.reduce((s, c) => s + c.total, 0);
    let acumulado = 0;
    const linhas = clientes.map((c) => {
      acumulado += c.total;
      const pctAcum = totalGeral > 0 ? (acumulado / totalGeral) * 100 : 0;
      const classe: "A" | "B" | "C" = pctAcum <= 80 ? "A" : pctAcum <= 95 ? "B" : "C";
      return {
        cliente: c.cliente,
        total: c.total,
        pct: totalGeral > 0 ? (c.total / totalGeral) * 100 : 0,
        pctAcum,
        classe,
      };
    });
    const contagem = { A: 0, B: 0, C: 0 };
    for (const l of linhas) contagem[l.classe]++;
    return { linhas, contagem, totalGeral };
  }, [clientes]);

  // ===== Novos x recorrentes x perdidos =====
  const cicloVida = useMemo(() => {
    let novos = 0;
    let recorrentes = 0;
    let perdidos = 0;
    for (const c of clientes) {
      if (c.classificacao === "novo") novos++;
      else if (c.classificacao === "perdido") perdidos++;
      else recorrentes++;
    }
    const pie = [
      { name: "Novos", value: novos },
      { name: "Recorrentes", value: recorrentes },
      { name: "Perdidos", value: perdidos },
    ].filter((d) => d.value > 0);
    return { novos, recorrentes, perdidos, pie };
  }, [clientes]);

  // ===== Frota ativa por cliente (placas distintas) =====
  const frota = useMemo(() => {
    return clientes
      .filter((c) => c.placas.size > 0)
      .map((c) => ({
        cliente: c.cliente,
        placas: c.placas.size,
        placasRecentes: c.placasRecentes.size,
        classificacao: c.classificacao,
      }))
      .sort((a, b) => b.placas - a.placas);
  }, [clientes]);

  const totalPlacas = useMemo(
    () => frota.reduce((s, f) => s + f.placas, 0),
    [frota],
  );

  const handleExport = () => {
    const data = clientes.map((c) => ({
      Cliente: c.cliente,
      "Total de atendimentos": c.total,
      "Últimos 30d": c.d30,
      "31 a 60d": c.d60,
      "61 a 90d": c.d90,
      "Frota (placas)": c.placas.size,
      "Classificação":
        c.classificacao === "novo" ? "Novo"
        : c.classificacao === "perdido" ? "Perdido"
        : "Recorrente",
      "Primeiro atendimento": new Date(c.primeiro).toLocaleDateString("pt-BR"),
      "Último atendimento": new Date(c.ultimo).toLocaleDateString("pt-BR"),
    }));
    exportToCSV(data, `retencao-clientes-${dateFrom}-a-${dateTo}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando dados de clientes...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Cabeçalho + export */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Retenção e Saúde de Clientes</span>
          </div>
          <span className="text-xs text-muted-foreground">
            Janelas de esfriamento (30/60/90 dias) e perdido ({JANELA_PERDIDO_DIAS} dias) são relativas à data de hoje.
          </span>
          <button
            type="button"
            onClick={handleExport}
            className="ml-auto h-8 inline-flex items-center gap-1.5 rounded-md border px-3 text-xs hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </CardContent>
      </Card>

      {/* KPIs ciclo de vida */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard title="Clientes ativos no período" value={clientes.length} icon={Users} subtitle={`${dateFrom} a ${dateTo}`} />
        <ReportKpiCard title="Novos" value={cicloVida.novos} icon={UserPlus} subtitle={`1º atendimento nos últimos ${JANELA_NOVO_DIAS}d`} />
        <ReportKpiCard title="Recorrentes" value={cicloVida.recorrentes} icon={RefreshCw} subtitle="ativos e antigos" />
        <ReportKpiCard title="Perdidos" value={cicloVida.perdidos} icon={UserMinus} subtitle={`sem contato há +${JANELA_PERDIDO_DIAS}d`} />
      </div>

      {/* Ciclo de vida + esfriando */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Novos x recorrentes x perdidos"
          data={cicloVida.pie.map((d) => ({ Situação: d.name, Clientes: d.value }))}
          filename="clientes-ciclo-vida"
          zoomable={false}
        >
          {cicloVida.pie.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={cicloVida.pie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {cicloVida.pie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              Sem clientes no período
            </div>
          )}
        </ChartFrame>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Snowflake className="h-4 w-4" /> Clientes esfriando
              <span className="text-xs font-normal text-muted-foreground">(queda dos últimos 30d vs 31–60d)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[280px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">0–30d</TableHead>
                    <TableHead className="text-right">31–60d</TableHead>
                    <TableHead className="text-right">61–90d</TableHead>
                    <TableHead className="text-right">Queda</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {esfriando.map((c) => (
                    <TableRow key={c.cliente} className={c.zerou ? "bg-red-50 dark:bg-red-950/30" : ""}>
                      <TableCell className="text-xs font-medium">
                        {c.cliente}
                        {c.zerou && (
                          <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200">
                            zerou
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs">{c.d30}</TableCell>
                      <TableCell className="text-right text-xs">{c.d60}</TableCell>
                      <TableCell className="text-right text-xs">{c.d90}</TableCell>
                      <TableCell className="text-right text-xs">
                        <span className="inline-flex items-center gap-1 text-red-600">
                          <TrendingDown className="h-3 w-3" /> {c.queda}%
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                  {esfriando.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum cliente esfriando detectado</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Curva ABC */}
      <div className="grid gap-3 grid-cols-3">
        {([
          { classe: "A" as const, valor: abc.contagem.A, subtitle: "até 80% do volume" },
          { classe: "B" as const, valor: abc.contagem.B, subtitle: "80% a 95%" },
          { classe: "C" as const, valor: abc.contagem.C, subtitle: "cauda longa" },
        ]).map((k) => (
          <button
            key={k.classe}
            type="button"
            onClick={() => setClasseAberta((atual) => (atual === k.classe ? null : k.classe))}
            className={`text-left rounded-lg transition-all ${
              classeAberta === k.classe ? "ring-2 ring-primary" : "hover:opacity-90"
            }`}
            aria-pressed={classeAberta === k.classe}
            title="Clique para ver os nomes dos clientes desta classe"
          >
            <ReportKpiCard title={`Clientes ${k.classe}`} value={k.valor} icon={Award} subtitle={k.subtitle} />
          </button>
        ))}
      </div>

      {classeAberta && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4" /> Clientes classe {classeAberta}
              <span className="text-xs font-normal text-muted-foreground">
                (clique no card novamente para fechar)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[320px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Atend.</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abc.linhas.filter((l) => l.classe === classeAberta).map((l) => (
                    <TableRow key={l.cliente}>
                      <TableCell className="text-xs font-medium">{l.cliente}</TableCell>
                      <TableCell className="text-right text-xs">{l.total}</TableCell>
                      <TableCell className="text-right text-xs">{l.pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  {abc.linhas.filter((l) => l.classe === classeAberta).length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhum cliente nesta classe</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Curva ABC de clientes (top 15 por volume)"
          data={abc.linhas.map((l) => ({
            Cliente: l.cliente,
            Atendimentos: l.total,
            "% do total": Number(l.pct.toFixed(1)),
            "% acumulado": Number(l.pctAcum.toFixed(1)),
            Classe: l.classe,
          }))}
          filename="curva-abc-clientes"
        >
          {abc.linhas.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={abc.linhas.slice(0, 15)} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="cliente" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="total" name="Atendimentos">
                  {abc.linhas.slice(0, 15).map((l, i) => (
                    <Cell key={i} fill={ABC_COLORS[l.classe]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
              Sem dados no período
            </div>
          )}
        </ChartFrame>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Award className="h-4 w-4" /> Ranking ABC
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[320px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Cliente</TableHead>
                    <TableHead className="text-right">Atend.</TableHead>
                    <TableHead className="text-right">% acum.</TableHead>
                    <TableHead className="text-center">Classe</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {abc.linhas.map((l) => (
                    <TableRow key={l.cliente}>
                      <TableCell className="text-xs font-medium">{l.cliente}</TableCell>
                      <TableCell className="text-right text-xs">{l.total}</TableCell>
                      <TableCell className="text-right text-xs">{l.pctAcum.toFixed(1)}%</TableCell>
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            l.classe === "A" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : l.classe === "B" ? "bg-amber-100 text-amber-800 border-amber-200"
                            : "bg-slate-100 text-slate-700 border-slate-200"
                          }
                        >
                          {l.classe}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                  {abc.linhas.length === 0 && (
                    <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem dados no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Frota ativa por cliente */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Car className="h-4 w-4" /> Frota ativa por cliente
            <span className="text-xs font-normal text-muted-foreground">({totalPlacas} placas distintas no total)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Frota (placas)</TableHead>
                  <TableHead className="text-right">Com serviço nos últimos 90d</TableHead>
                  <TableHead className="text-center">Situação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {frota.map((f) => (
                  <TableRow key={f.cliente}>
                    <TableCell className="text-xs font-medium">{f.cliente}</TableCell>
                    <TableCell className="text-right text-xs">{f.placas}</TableCell>
                    <TableCell className="text-right text-xs">{f.placasRecentes}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          f.classificacao === "novo" ? "bg-sky-100 text-sky-800 border-sky-200"
                          : f.classificacao === "perdido" ? "bg-red-100 text-red-800 border-red-200"
                          : "bg-emerald-100 text-emerald-800 border-emerald-200"
                        }
                      >
                        {f.classificacao === "novo" ? "Novo" : f.classificacao === "perdido" ? "Perdido" : "Recorrente"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                {frota.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Nenhuma placa registrada no período</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
