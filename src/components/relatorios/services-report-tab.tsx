import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ReportKpiCard } from "./report-kpi-card";
import { ChartFrame } from "./chart-frame";
import { exportToCSV } from "./export-utils";
import {
  parseTesteEquipamentoNotes,
  isTesteEquipamentoCategory,
} from "@/hooks/use-teste-equipamento-settings";
import {
  Loader2, Wrench, Download, PackagePlus, PackageMinus, Search, AlertTriangle,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Tooltip, Legend,
  LineChart, Line,
} from "recharts";

interface Props {
  dateFrom: string;
  dateTo: string;
}

type Subtipo = "Instalação" | "Retirada" | "Manutenção";

interface ServiceRow {
  id: string;
  cliente: string;
  placa: string;
  subtipo: Subtipo | "—";
  garantia: string;
  cobrar: string;
  status: string;
  created_at: string;
}

export function ServicesReportTab({ dateFrom, dateTo }: Props) {
  const [search, setSearch] = useState("");
  const [tipo, setTipo] = useState<"todos" | Subtipo>("todos");

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
          <CardTitle className="text-sm">Detalhamento ({filtered.length} serviços — exibindo até 200)</CardTitle>
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
              {filtered.slice(0, 200).map((r) => (
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
      </Card>
    </div>
  );
}
