import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Pagination, PaginationContent, PaginationItem, PaginationLink,
  PaginationNext, PaginationPrevious,
} from "@/components/ui/pagination";
import { ReportKpiCard } from "./report-kpi-card";
import { ChartFrame } from "./chart-frame";
import { exportToCSV } from "./export-utils";
import {
  parseTesteEquipamentoNotes,
  isTesteEquipamentoCategory,
} from "@/hooks/use-teste-equipamento-settings";
import {
  Loader2, Wrench, Download, PackagePlus, PackageMinus, Search, AlertTriangle,
  RotateCcw, ShieldCheck, DollarSign,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line, PieChart, Pie, Cell,
} from "recharts";

interface Props {
  dateFrom: string;
  dateTo: string;
}

type Subtipo = "Instalação" | "Retirada" | "Manutenção";

// Janela (em dias) para considerar uma manutenção como "retorno" após instalação recente
const JANELA_RETORNO_DIAS = 30;

interface ServiceRow {
  id: string;
  cliente: string;
  placa: string;
  subtipo: Subtipo | "—";
  garantia: string;
  cobrar: string;
  equipamento: string;
  status: string;
  created_at: string;
}

// Verifica se o texto do campo garantia indica "em garantia"
function isEmGarantia(garantia: string): boolean {
  const g = (garantia || "").trim().toLowerCase();
  if (!g || g === "—") return false;
  return g.includes("garantia") || g === "sim" || g.startsWith("s");
}

const PAGE_SIZE = 20;

export function ServicesReportTab({ dateFrom, dateTo }: Props) {
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<"todos" | Subtipo>("todos");
  const [page, setPage] = useState(1);

  const { data: tickets = [], isLoading } = useQuery({
    queryKey: ["report-services", dateFrom, dateTo],
    queryFn: async () => {
      const fromIso = new Date(`${dateFrom}T00:00:00`).toISOString();
      const toIso = new Date(`${dateTo}T23:59:59`).toISOString();
      const { data, error } = await supabase
        .from("service_tickets")
        .select("id, category, plate, notes, status, created_at, closed_at, contact_name, companies:company_id(name)")
        .gte("created_at", fromIso)
        .lte("created_at", toIso)
        .order("created_at", { ascending: false })
        .limit(5000);
      if (error) throw error;
      return (data || []) as any[];
    },
  });

  // Apenas chamados da categoria Teste de Equipamento
  const rows = useMemo<ServiceRow[]>(() => {
    return tickets
      .filter((t) => isTesteEquipamentoCategory(t.category))
      .map((t) => {
        const parsed = parseTesteEquipamentoNotes(t.notes);
        return {
          id: t.id,
          cliente: t.companies?.name || t.contact_name || "—",
          placa: (t.plate || "").toUpperCase() || "—",
          subtipo: (parsed.subtipo || "—") as Subtipo | "—",
          garantia: parsed.garantia || "—",
          cobrar: parsed.necessario_cobrar || "—",
          equipamento: parsed.equipamento || "—",
          status: t.status,
          created_at: t.created_at,
        };
      });
  }, [tickets]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (tipo !== "todos" && r.subtipo !== tipo) return false;
      if (term) {
        const hay = [r.cliente, r.placa, r.subtipo].join(" ").toLowerCase();
        if (!hay.includes(term)) return false;
      }
      return true;
    });
  }, [rows, tipo, search]);

  // Volta para a primeira página sempre que o filtro muda
  useEffect(() => {
    setPage(1);
  }, [tipo, search, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const paged = useMemo(
    () => filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filtered, currentPage],
  );

  // Números de página a exibir (janela ao redor da página atual)
  const pageNumbers = useMemo(() => {
    const nums: number[] = [];
    const start = Math.max(1, currentPage - 2);
    const end = Math.min(totalPages, start + 4);
    for (let i = start; i <= end; i++) nums.push(i);
    return nums;
  }, [currentPage, totalPages]);

  const kpis = useMemo(() => {
    const count = (s: Subtipo) => filtered.filter((r) => r.subtipo === s).length;
    return {
      total: filtered.length,
      instalacoes: count("Instalação"),
      retiradas: count("Retirada"),
      manutencoes: count("Manutenção"),
    };
  }, [filtered]);

  // Serviços por cliente
  const byCliente = useMemo(() => {
    const map = new Map<string, { cliente: string; total: number; instalacao: number; retirada: number; manutencao: number }>();
    for (const r of filtered) {
      const e = map.get(r.cliente) || { cliente: r.cliente, total: 0, instalacao: 0, retirada: 0, manutencao: 0 };
      e.total++;
      if (r.subtipo === "Instalação") e.instalacao++;
      else if (r.subtipo === "Retirada") e.retirada++;
      else if (r.subtipo === "Manutenção") e.manutencao++;
      map.set(r.cliente, e);
    }
    return Array.from(map.values()).sort((a, b) => b.total - a.total);
  }, [filtered]);

  // Manutenções por placa (realça placas com 2+ manutenções)
  const byPlaca = useMemo(() => {
    const map = new Map<string, { placa: string; cliente: string; manutencoes: number; total: number }>();
    for (const r of filtered) {
      if (r.placa === "—") continue;
      const e = map.get(r.placa) || { placa: r.placa, cliente: r.cliente, manutencoes: 0, total: 0 };
      e.total++;
      if (r.subtipo === "Manutenção") e.manutencoes++;
      map.set(r.placa, e);
    }
    return Array.from(map.values())
      .filter((e) => e.manutencoes > 0)
      .sort((a, b) => b.manutencoes - a.manutencoes);
  }, [filtered]);

  const placasRecorrentes = useMemo(
    () => byPlaca.filter((p) => p.manutencoes >= 2).length,
    [byPlaca],
  );

  // ===== Taxa de retorno: manutenção após instalação recente na mesma placa =====
  const retorno = useMemo(() => {
    // Agrupa por placa apenas instalações e manutenções (usa filtered para respeitar busca/tipo)
    const porPlaca = new Map<string, ServiceRow[]>();
    for (const r of filtered) {
      if (r.placa === "—") continue;
      if (r.subtipo !== "Instalação" && r.subtipo !== "Manutenção") continue;
      const list = porPlaca.get(r.placa) || [];
      list.push(r);
      porPlaca.set(r.placa, list);
    }

    const retornos: {
      placa: string;
      cliente: string;
      instalacao: string;
      manutencao: string;
      dias: number;
    }[] = [];
    let totalInstalacoes = 0;

    for (const [placa, list] of porPlaca) {
      const instalacoes = list
        .filter((r) => r.subtipo === "Instalação")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      const manutencoes = list
        .filter((r) => r.subtipo === "Manutenção")
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

      totalInstalacoes += instalacoes.length;

      for (const inst of instalacoes) {
        const instTime = new Date(inst.created_at).getTime();
        // Primeira manutenção após esta instalação dentro da janela
        const manut = manutencoes.find((m) => {
          const mt = new Date(m.created_at).getTime();
          if (mt <= instTime) return false;
          const dias = (mt - instTime) / (1000 * 60 * 60 * 24);
          return dias <= JANELA_RETORNO_DIAS;
        });
        if (manut) {
          const dias = Math.round(
            (new Date(manut.created_at).getTime() - instTime) / (1000 * 60 * 60 * 24),
          );
          retornos.push({
            placa,
            cliente: inst.cliente,
            instalacao: inst.created_at,
            manutencao: manut.created_at,
            dias,
          });
        }
      }
    }

    retornos.sort((a, b) => a.dias - b.dias);
    const taxa = totalInstalacoes > 0 ? (retornos.length / totalInstalacoes) * 100 : 0;
    return { retornos, totalInstalacoes, taxa };
  }, [filtered]);

  // ===== Proporção de manutenção por item (equipamento) =====
  const manutencaoPorItem = useMemo(() => {
    const map = new Map<string, number>();
    let semItem = 0;
    let totalManutencoes = 0;
    for (const r of filtered) {
      if (r.subtipo !== "Manutenção") continue;
      totalManutencoes++;
      const item = (r.equipamento || "").trim();
      if (!item || item === "—") {
        semItem++;
        continue;
      }
      map.set(item, (map.get(item) || 0) + 1);
    }
    const totalComItem = totalManutencoes - semItem;
    const linhas = Array.from(map.entries())
      .map(([item, qtd]) => ({
        item,
        qtd,
        pct: totalComItem > 0 ? (qtd / totalComItem) * 100 : 0,
      }))
      .sort((a, b) => b.qtd - a.qtd);
    return { linhas, semItem, totalManutencoes, totalComItem };
  }, [filtered]);

  // ===== Garantia x cobrada (apenas manutenções) =====
  const garantiaData = useMemo(() => {
    let emGarantia = 0;
    let cobrada = 0;
    let naoInformado = 0;
    for (const r of filtered) {
      if (r.subtipo !== "Manutenção") continue;
      const g = (r.garantia || "").trim();
      if (!g || g === "—") { naoInformado++; continue; }
      if (isEmGarantia(g)) emGarantia++;
      else cobrada++;
    }
    const classificadas = emGarantia + cobrada;
    const pctCobrada = classificadas > 0 ? (cobrada / classificadas) * 100 : 0;
    const pie = [
      { name: "Em garantia", value: emGarantia },
      { name: "Cobradas", value: cobrada },
    ].filter((d) => d.value > 0);
    return { emGarantia, cobrada, naoInformado, classificadas, pctCobrada, pie };
  }, [filtered]);

  // Evolução diária por tipo
  const byDay = useMemo(() => {
    const map = new Map<string, { day: string; Instalação: number; Retirada: number; Manutenção: number }>();
    const key = (iso: string) => new Date(iso).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    for (const r of filtered) {
      const d = key(r.created_at);
      const e = map.get(d) || { day: d, "Instalação": 0, "Retirada": 0, "Manutenção": 0 };
      if (r.subtipo === "Instalação") e["Instalação"]++;
      else if (r.subtipo === "Retirada") e["Retirada"]++;
      else if (r.subtipo === "Manutenção") e["Manutenção"]++;
      map.set(d, e);
    }
    return Array.from(map.values()).sort((a, b) => {
      const [da, ma, ya] = a.day.split("/").map(Number);
      const [db, mb, yb] = b.day.split("/").map(Number);
      return new Date(ya, ma - 1, da).getTime() - new Date(yb, mb - 1, db).getTime();
    });
  }, [filtered]);

  const PIE_COLORS = ["#22c55e", "#ef4444"];

  const handleExport = () => {
    const data = filtered.map((r) => ({
      Cliente: r.cliente,
      Placa: r.placa,
      Tipo: r.subtipo,
      Garantia: r.garantia,
      "Necessário cobrar": r.cobrar,
      Status: r.status,
      Data: new Date(r.created_at).toLocaleDateString("pt-BR"),
    }));
    exportToCSV(data, `servicos-tecnicos-${dateFrom}-a-${dateTo}`);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Carregando serviços...
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4 flex flex-wrap items-end gap-3">
          <div className="flex items-center gap-2">
            <Wrench className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-foreground">Serviços de Teste de Equipamento</span>
          </div>
          <div>
            <Label className="text-xs">Tipo</Label>
            <div className="flex gap-1">
              {(["todos", "Instalação", "Retirada", "Manutenção"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className={`h-8 rounded-md border px-3 text-xs transition-colors ${
                    tipo === t ? "bg-primary text-primary-foreground border-primary" : "bg-background hover:bg-muted"
                  }`}
                >
                  {t === "todos" ? "Todos" : t}
                </button>
              ))}
            </div>
          </div>
          <div className="flex-1 min-w-[180px]">
            <Label className="text-xs">Busca</Label>
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Cliente, placa..."
                className="h-8 text-xs pl-7"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={handleExport}
            className="h-8 inline-flex items-center gap-1.5 rounded-md border px-3 text-xs hover:bg-muted transition-colors"
          >
            <Download className="h-3.5 w-3.5" /> Exportar CSV
          </button>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard title="Total de serviços" value={kpis.total} icon={Wrench} subtitle={`${dateFrom} a ${dateTo}`} />
        <ReportKpiCard title="Instalações" value={kpis.instalacoes} icon={PackagePlus} />
        <ReportKpiCard title="Retiradas" value={kpis.retiradas} icon={PackageMinus} />
        <ReportKpiCard title="Manutenções" value={kpis.manutencoes} icon={Wrench} subtitle={`${placasRecorrentes} placa(s) com 2+`} />
      </div>

      {/* KPIs de taxa de retorno e garantia */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <ReportKpiCard
          title="Taxa de retorno"
          value={`${retorno.taxa.toFixed(1)}%`}
          icon={RotateCcw}
          subtitle={`${retorno.retornos.length} de ${retorno.totalInstalacoes} instalações (até ${JANELA_RETORNO_DIAS} dias)`}
        />
        <ReportKpiCard
          title="Manutenções em garantia"
          value={garantiaData.emGarantia}
          icon={ShieldCheck}
        />
        <ReportKpiCard
          title="Manutenções cobradas"
          value={garantiaData.cobrada}
          icon={DollarSign}
          subtitle={garantiaData.classificadas > 0 ? `${garantiaData.pctCobrada.toFixed(1)}% do total classificado` : "sem dados"}
        />
        <ReportKpiCard
          title="Garantia não informada"
          value={garantiaData.naoInformado}
          icon={AlertTriangle}
          subtitle="manutenções sem campo garantia"
        />
      </div>

      {/* Evolução */}
      <ChartFrame title="Evolução de serviços por dia" data={byDay as any} filename="servicos-evolucao">
        <ResponsiveContainer width="100%" height={280}>
          <LineChart data={byDay}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis dataKey="day" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="Instalação" stroke="#22c55e" strokeWidth={2} />
            <Line type="monotone" dataKey="Retirada" stroke="#f59e0b" strokeWidth={2} />
            <Line type="monotone" dataKey="Manutenção" stroke="#ef4444" strokeWidth={2} />
          </LineChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* Proporção garantia x cobrada */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Manutenções: garantia x cobradas"
          data={[
            { Tipo: "Em garantia", Quantidade: garantiaData.emGarantia },
            { Tipo: "Cobradas", Quantidade: garantiaData.cobrada },
            { Tipo: "Não informado", Quantidade: garantiaData.naoInformado },
          ]}
          filename="manutencoes-garantia-cobrada"
          zoomable={false}
        >
          {garantiaData.pie.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={garantiaData.pie}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  label={({ name, percent }: any) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                >
                  {garantiaData.pie.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              Sem manutenções com garantia informada no período
            </div>
          )}
        </ChartFrame>

        {/* Tabela de retornos */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Retornos (manutenção após instalação recente)
              <span className="text-xs font-normal text-muted-foreground">(janela de {JANELA_RETORNO_DIAS} dias)</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[280px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Placa</TableHead>
                    <TableHead>Cliente</TableHead>
                    <TableHead>Instalação</TableHead>
                    <TableHead>Manutenção</TableHead>
                    <TableHead className="text-right">Dias</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {retorno.retornos.map((r, i) => (
                    <TableRow key={`${r.placa}-${i}`} className="bg-red-50 dark:bg-red-950/30">
                      <TableCell className="font-mono text-xs font-medium">{r.placa}</TableCell>
                      <TableCell className="text-xs">{r.cliente}</TableCell>
                      <TableCell className="text-xs">{new Date(r.instalacao).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-xs">{new Date(r.manutencao).toLocaleDateString("pt-BR")}</TableCell>
                      <TableCell className="text-right text-xs">{r.dias}</TableCell>
                    </TableRow>
                  ))}
                  {retorno.retornos.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-6">Nenhum retorno dentro da janela no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Proporção de manutenção por item (equipamento) */}
      <div className="grid gap-4 lg:grid-cols-2">
        <ChartFrame
          title="Manutenções por item"
          data={manutencaoPorItem.linhas.map((l) => ({
            Item: l.item,
            Manutenções: l.qtd,
            "% do total": Number(l.pct.toFixed(1)),
          }))}
          filename="manutencoes-por-item"
        >
          {manutencaoPorItem.linhas.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              <BarChart data={manutencaoPorItem.linhas.slice(0, 12)} layout="vertical" margin={{ left: 24 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="item" width={150} tick={{ fontSize: 10 }} />
                <Tooltip />
                <Bar dataKey="qtd" name="Manutenções" fill="#ef4444" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
              Nenhuma manutenção com equipamento informado no período
            </div>
          )}
        </ChartFrame>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Wrench className="h-4 w-4" /> Proporção de manutenção por item
              {manutencaoPorItem.semItem > 0 && (
                <span className="text-xs font-normal text-muted-foreground">
                  ({manutencaoPorItem.semItem} sem item informado)
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="max-h-[320px] overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="text-right">Manutenções</TableHead>
                    <TableHead className="text-right">% do total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {manutencaoPorItem.linhas.map((l) => (
                    <TableRow key={l.item}>
                      <TableCell className="text-xs">{l.item}</TableCell>
                      <TableCell className="text-right text-xs">{l.qtd}</TableCell>
                      <TableCell className="text-right text-xs">{l.pct.toFixed(1)}%</TableCell>
                    </TableRow>
                  ))}
                  {manutencaoPorItem.linhas.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-6">Nenhuma manutenção com equipamento informado no período</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Serviços por cliente */}
      <ChartFrame
        title="Serviços por cliente"
        data={byCliente.map((c) => ({ Cliente: c.cliente, Total: c.total, Instalações: c.instalacao, Retiradas: c.retirada, Manutenções: c.manutencao }))}
        filename="servicos-por-cliente"
      >
        <ResponsiveContainer width="100%" height={320}>
          <BarChart data={byCliente.slice(0, 12)} layout="vertical" margin={{ left: 24 }}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
            <XAxis type="number" tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="cliente" width={150} tick={{ fontSize: 10 }} />
            <Tooltip />
            <Legend />
            <Bar dataKey="instalacao" name="Instalação" stackId="a" fill="#22c55e" />
            <Bar dataKey="retirada" name="Retirada" stackId="a" fill="#f59e0b" />
            <Bar dataKey="manutencao" name="Manutenção" stackId="a" fill="#ef4444" />
          </BarChart>
        </ResponsiveContainer>
      </ChartFrame>

      {/* Manutenções por placa */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" /> Manutenções por placa
            <span className="text-xs font-normal text-muted-foreground">(placas em vermelho tiveram 2+ manutenções no período)</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="max-h-[360px] overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Placa</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead className="text-right">Manutenções</TableHead>
                  <TableHead className="text-right">Total de serviços</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {byPlaca.map((p) => {
                  const recorrente = p.manutencoes >= 2;
                  return (
                    <TableRow key={p.placa} className={recorrente ? "bg-red-50 dark:bg-red-950/30" : ""}>
                      <TableCell className="font-mono text-xs font-medium">
                        {p.placa}
                        {recorrente && (
                          <Badge variant="outline" className="ml-2 bg-red-100 text-red-800 border-red-200 dark:bg-red-900/40 dark:text-red-200">
                            recorrente
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">{p.cliente}</TableCell>
                      <TableCell className="text-right">{p.manutencoes}</TableCell>
                      <TableCell className="text-right">{p.total}</TableCell>
                    </TableRow>
                  );
                })}
                {byPlaca.length === 0 && (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-6">Sem manutenções no período</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Detalhamento */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Detalhamento ({filtered.length} serviços — página {currentPage} de {totalPages})</CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Garantia</TableHead>
                <TableHead>Cobrar</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Data</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="text-xs">{r.cliente}</TableCell>
                  <TableCell className="font-mono text-xs">{r.placa}</TableCell>
                  <TableCell className="text-xs">
                    <Badge
                      variant="outline"
                      className={
                        r.subtipo === "Instalação" ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                        : r.subtipo === "Retirada" ? "bg-amber-100 text-amber-800 border-amber-200"
                        : r.subtipo === "Manutenção" ? "bg-red-100 text-red-800 border-red-200"
                        : ""
                      }
                    >
                      {r.subtipo}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs">{r.garantia}</TableCell>
                  <TableCell className="text-xs">{r.cobrar}</TableCell>
                  <TableCell className="text-xs">
                    <Badge variant={r.status === "finalizado" ? "default" : "secondary"}>{r.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs">{new Date(r.created_at).toLocaleDateString("pt-BR")}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-6">Nenhum serviço encontrado no período</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        {totalPages > 1 && (
          <div className="flex items-center justify-between gap-2 border-t px-4 py-3">
            <span className="text-xs text-muted-foreground">
              Exibindo {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} de {filtered.length}
            </span>
            <Pagination className="mx-0 w-auto justify-end">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.max(1, p - 1)); }}
                    className={currentPage <= 1 ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
                {pageNumbers.map((n) => (
                  <PaginationItem key={n}>
                    <PaginationLink
                      href="#"
                      isActive={n === currentPage}
                      onClick={(e) => { e.preventDefault(); setPage(n); }}
                    >
                      {n}
                    </PaginationLink>
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    href="#"
                    onClick={(e) => { e.preventDefault(); setPage((p) => Math.min(totalPages, p + 1)); }}
                    className={currentPage >= totalPages ? "pointer-events-none opacity-50" : ""}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </Card>
    </div>
  );
}
