import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { AppLayout } from "@/components/app-layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { getVeiculos, getVeiculoTipos, getCadastrosByTipo, discoverEquipamentos, discoverChips, listEquipamentosFromVeiculos, probeEquipamentosDeep } from "@/lib/gsystem-api.functions";
import { Search, Package, Car, RefreshCw, Loader2, AlertCircle, Cpu, Wifi, Stethoscope } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

export const Route = createFileRoute("/estoque")({
  component: EstoquePage,
});

type InventoryItem = {
  id: string;
  name: string;
  model: string | null;
  status: "disponivel" | "vinculado";
};

type CadastroItem = {
  key: string;
  descricao: string;
  modelo: string;
  identificador: string;
  status: string;
  vinculo: string | null;
};

const EQUIP_CANDIDATES = [
  "Equipamentos",
  "Equipamento",
  "Rastreador",
  "Rastreadores",
  "Equipamento_Rastreador",
];
const CHIP_CANDIDATES = ["Chips", "Chip", "SIM", "SimCard", "Linhas", "Linha"];

function classifyStatus(raw: string): "disponivel" | "vinculado" | "inativo" | "outro" {
  const s = String(raw || "").trim().toLowerCase();
  if (!s) return "outro";
  if (s.includes("dispon")) return "disponivel";
  if (s.includes("inativ")) return "inativo";
  if (s.includes("vincul") || s.includes("uso") || s.includes("ativ")) return "vinculado";
  return "outro";
}

function EstoquePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("disponivel");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [tab, setTab] = useState("equipamentos");
  const [diagOpen, setDiagOpen] = useState(false);
  const [diagLoading, setDiagLoading] = useState(false);
  const [diagResult, setDiagResult] = useState<any>(null);

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  const runDeepProbe = async () => {
    setDiagLoading(true);
    setDiagResult(null);
    try {
      const auth = await getAuthHeaders();
      const result = await probeEquipamentosDeep(auth);
      setDiagResult(result);
      const found = result.successfulEndpoints?.length || 0;
      if (found > 0) toast.success(`Encontrei ${found} endpoint(s) com dados`);
      else toast.warning("Nenhum endpoint padrão respondeu com lista de itens");
    } catch (e: any) {
      toast.error(e?.message || "Erro na sondagem");
    } finally {
      setDiagLoading(false);
    }
  };

  // Equipamentos: try dedicated endpoints first, fallback to /cadastros
  const equipQuery = useQuery({
    queryKey: ["gsystem-equipamentos-v2"],
    queryFn: async () => {
      const auth = await getAuthHeaders();
      const direct = await discoverEquipamentos(auth);
      if (direct.matchedEndpoint && direct.items.length > 0) {
        return {
          source: "endpoint" as const,
          matched: direct.matchedEndpoint,
          tried: direct.tried,
          items: direct.items as CadastroItem[],
          availableTipos: [] as string[],
        };
      }
      const veiculosFallback = await listEquipamentosFromVeiculos(auth);
      if (veiculosFallback.items.length > 0) {
        return {
          source: "veiculos" as const,
          matched: "/veiculos → Equipamento/EquipamentoSecundario",
          tried: direct.tried,
          items: veiculosFallback.items as CadastroItem[],
          availableTipos: [] as string[],
        };
      }
      const fb = await getCadastrosByTipo({ ...auth, data: { candidates: EQUIP_CANDIDATES } });
      return {
        source: "cadastros" as const,
        matched: fb.matchedTipo,
        tried: direct.tried,
        items: (fb.items ?? []) as CadastroItem[],
        availableTipos: fb.availableTipos ?? [],
      };
    },
    enabled: isAuthenticated && tab === "equipamentos",
    staleTime: 5 * 60 * 1000,
  });

  // Chips: try dedicated endpoints first, fallback to /cadastros
  const chipsQuery = useQuery({
    queryKey: ["gsystem-chips-v2"],
    queryFn: async () => {
      const auth = await getAuthHeaders();
      const direct = await discoverChips(auth);
      if (direct.matchedEndpoint && direct.items.length > 0) {
        return {
          source: "endpoint" as const,
          matched: direct.matchedEndpoint,
          tried: direct.tried,
          items: direct.items as CadastroItem[],
          availableTipos: [] as string[],
        };
      }
      const fb = await getCadastrosByTipo({ ...auth, data: { candidates: CHIP_CANDIDATES } });
      return {
        source: "cadastros" as const,
        matched: fb.matchedTipo,
        tried: direct.tried,
        items: (fb.items ?? []) as CadastroItem[],
        availableTipos: fb.availableTipos ?? [],
      };
    },
    enabled: isAuthenticated && tab === "chips",
    staleTime: 5 * 60 * 1000,
  });

  // GSystem Veículos
  const { data: veiculos = [], isLoading: veiculosLoading, error: veiculosError, refetch: refetchVeiculos } = useQuery({
    queryKey: ["gsystem-veiculos"],
    queryFn: async () => {
      const result = await getVeiculos({
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : (result as any)?.data || (result as any)?.Data || [];
    },
    enabled: isAuthenticated && tab === "veiculos",
    retry: 1,
  });

  const { data: veiculoTipos = [] } = useQuery({
    queryKey: ["gsystem-veiculo-tipos"],
    queryFn: async () => {
      const result = await getVeiculoTipos({
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated && tab === "veiculos",
    retry: 1,
  });

  // Local inventory (fallback)
  const { data: localItems = [], isLoading: localLoading } = useQuery({
    queryKey: ["local-inventory"],
    queryFn: async () => {
      const { data } = await supabase
        .from("inventory_items")
        .select("id, name, model, status")
        .order("name", { ascending: true });
      return (data as InventoryItem[]) || [];
    },
    enabled: isAuthenticated && tab === "local",
  });

  const gsystemModels = useMemo(() => {
    const models = new Set<string>();
    veiculos.forEach((v: any) => {
      const model = v.Modelo || v.modelo || v.TipoVeiculo || v.tipoVeiculo;
      if (model) models.add(model);
    });
    return Array.from(models).sort();
  }, [veiculos]);

  const localModels = useMemo(() => {
    const models = new Set<string>();
    localItems.forEach((item) => { if (item.model) models.add(item.model); });
    return Array.from(models).sort();
  }, [localItems]);

  if (isLoading || !isAuthenticated) return null;

  // ----- Filtering helpers for cadastros -----
  function filterCadastros(items: CadastroItem[]): CadastroItem[] {
    return items.filter((it) => {
      const matchesSearch = !search ||
        it.descricao.toLowerCase().includes(search.toLowerCase()) ||
        it.identificador.toLowerCase().includes(search.toLowerCase()) ||
        it.modelo.toLowerCase().includes(search.toLowerCase()) ||
        it.key.toLowerCase().includes(search.toLowerCase());
      const matchesModel = modelFilter === "all" || it.modelo === modelFilter;
      const cls = classifyStatus(it.status);
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "disponivel" && cls === "disponivel") ||
        (statusFilter === "vinculado" && cls === "vinculado") ||
        (statusFilter === "inativo" && cls === "inativo");
      return matchesSearch && matchesModel && matchesStatus;
    });
  }

  function cadastrosModels(items: CadastroItem[]): string[] {
    const set = new Set<string>();
    items.forEach((i) => { if (i.modelo) set.add(i.modelo); });
    return Array.from(set).sort();
  }

  const equipItems: CadastroItem[] = equipQuery.data?.items ?? [];
  const chipItems: CadastroItem[] = chipsQuery.data?.items ?? [];

  const equipFiltered = filterCadastros(equipItems);
  const chipFiltered = filterCadastros(chipItems);

  // Filter GSystem vehicles
  const filteredVeiculos = veiculos.filter((v: any) => {
    const placa = v.Placa || v.placa || "";
    const modelo = v.Modelo || v.modelo || v.TipoVeiculo || v.tipoVeiculo || "";
    const nome = v.Descricao || v.descricao || v.Nome || v.nome || placa;
    const status = v.Status || v.status || "";

    const matchesSearch = !search ||
      nome.toLowerCase().includes(search.toLowerCase()) ||
      placa.toLowerCase().includes(search.toLowerCase()) ||
      modelo.toLowerCase().includes(search.toLowerCase());
    const matchesModel = modelFilter === "all" || modelo === modelFilter;
    const matchesStatus = statusFilter === "all" ||
      (statusFilter === "disponivel" && (status === "Ativo" || status === 1 || status === "1")) ||
      (statusFilter === "inativo" && (status === "Inativo" || status === 0 || status === "0"));
    return matchesSearch && matchesModel && matchesStatus;
  });

  const filteredLocal = localItems.filter((item) => {
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.model && item.model.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || statusFilter === item.status ||
      (statusFilter === "disponivel" && item.status === "disponivel") ||
      (statusFilter === "vinculado" && item.status === "vinculado");
    const matchesModel = modelFilter === "all" || item.model === modelFilter;
    return matchesSearch && matchesStatus && matchesModel;
  });

  // Pick model dropdown options based on tab
  const currentModels =
    tab === "equipamentos" ? cadastrosModels(equipItems) :
    tab === "chips" ? cadastrosModels(chipItems) :
    tab === "veiculos" ? gsystemModels :
    localModels;

  // KPIs by tab
  function cadastroKpis(items: CadastroItem[]) {
    let disp = 0, vinc = 0, inat = 0;
    items.forEach((i) => {
      const c = classifyStatus(i.status);
      if (c === "disponivel") disp++;
      else if (c === "vinculado") vinc++;
      else if (c === "inativo") inat++;
    });
    return { total: items.length, disp, vinc, inat };
  }
  const equipKpis = cadastroKpis(equipItems);
  const chipKpis = cadastroKpis(chipItems);

  const refreshActive = () => {
    if (tab === "equipamentos") equipQuery.refetch();
    else if (tab === "chips") chipsQuery.refetch();
    else if (tab === "veiculos") refetchVeiculos();
  };

  const isAnyLoading =
    (tab === "equipamentos" && equipQuery.isLoading) ||
    (tab === "chips" && chipsQuery.isLoading) ||
    (tab === "veiculos" && veiculosLoading);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Consulta de Estoque</h1>
            <p className="text-sm text-muted-foreground">Equipamentos, chips e veículos do GSystem</p>
          </div>
          <div className="flex items-center gap-2">
            <Dialog open={diagOpen} onOpenChange={setDiagOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" onClick={() => { setDiagOpen(true); runDeepProbe(); }}>
                  <Stethoscope className="h-4 w-4 mr-1" /> Diagnóstico
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh]">
                <DialogHeader>
                  <DialogTitle>Sondagem profunda da API GSystem</DialogTitle>
                </DialogHeader>
                <ScrollArea className="h-[60vh] pr-3">
                  {diagLoading && (
                    <div className="flex items-center gap-2 py-8 justify-center text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" /> Consultando endpoints...
                    </div>
                  )}
                  {diagResult && (
                    <div className="space-y-4 text-xs">
                      <div>
                        <p className="font-semibold mb-1">Endpoints com dados ({diagResult.successfulEndpoints?.length || 0}):</p>
                        {diagResult.successfulEndpoints?.length > 0 ? (
                          <div className="space-y-2">
                            {diagResult.successfulEndpoints.map((s: any) => (
                              <div key={s.endpoint} className="rounded border bg-emerald-50 dark:bg-emerald-950/20 p-2">
                                <p className="font-mono font-semibold">{s.endpoint} — {s.count} item(ns)</p>
                                <p className="text-muted-foreground mt-1">Campos: {s.firstItemKeys?.join(", ")}</p>
                                {s.sample && <pre className="mt-1 text-[10px] bg-background rounded p-1 overflow-x-auto">{JSON.stringify(s.sample, null, 2)}</pre>}
                              </div>
                            ))}
                          </div>
                        ) : <p className="text-muted-foreground">Nenhum endpoint direto retornou itens.</p>}
                      </div>

                      <div>
                        <p className="font-semibold mb-1">Tipos disponíveis em /cadastros ({diagResult.cadastrosByTipo?.length || 0}):</p>
                        <div className="rounded border bg-muted/30 p-2 space-y-1 max-h-60 overflow-auto">
                          {diagResult.cadastrosByTipo?.map((t: any) => (
                            <div key={t.tipo} className="flex justify-between font-mono">
                              <span>{t.tipo}</span>
                              <span className="text-muted-foreground">{t.count}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="font-semibold mb-1">Todos os endpoints testados:</p>
                        <div className="rounded border bg-muted/30 p-2 space-y-0.5 font-mono">
                          {diagResult.endpoints?.map((r: any) => (
                            <div key={r.endpoint} className="flex justify-between">
                              <span>{r.endpoint}</span>
                              <span className="text-muted-foreground">{r.status}{r.count != null ? ` (${r.count})` : ""}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </ScrollArea>
              </DialogContent>
            </Dialog>
            {tab !== "local" && (
              <Button variant="outline" size="sm" onClick={refreshActive} disabled={isAnyLoading}>
                <RefreshCw className={`h-4 w-4 ${isAnyLoading ? "animate-spin" : ""}`} />
              </Button>
            )}
          </div>
        </div>

        {/* KPI cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {tab === "equipamentos" || tab === "chips" ? (
            <>
              <KpiCard label="Total" value={tab === "equipamentos" ? equipKpis.total : chipKpis.total} />
              <KpiCard label="Disponíveis" value={tab === "equipamentos" ? equipKpis.disp : chipKpis.disp} accent="emerald" />
              <KpiCard label="Vinculados / Em uso" value={tab === "equipamentos" ? equipKpis.vinc : chipKpis.vinc} accent="amber" />
              <KpiCard label="Inativos" value={tab === "equipamentos" ? equipKpis.inat : chipKpis.inat} accent="muted" />
            </>
          ) : tab === "veiculos" ? (
            <>
              <KpiCard label="Total" value={filteredVeiculos.length} />
              <KpiCard label="Veículos" value={veiculos.length} accent="emerald" />
              <KpiCard label="Tipos" value={veiculoTipos.length} />
              <KpiCard label="Filtrados" value={filteredVeiculos.length} accent="muted" />
            </>
          ) : (
            <>
              <KpiCard label="Total" value={filteredLocal.length} />
              <KpiCard label="Disponíveis" value={filteredLocal.filter((i) => i.status === "disponivel").length} accent="emerald" />
              <KpiCard label="Vinculados" value={filteredLocal.filter((i) => i.status === "vinculado").length} accent="amber" />
              <KpiCard label="Modelos" value={localModels.length} />
            </>
          )}
        </div>

        <Tabs value={tab} onValueChange={(v) => { setTab(v); setModelFilter("all"); }}>
          <TabsList>
            <TabsTrigger value="equipamentos">
              <Cpu className="h-4 w-4 mr-1" /> Equipamentos
            </TabsTrigger>
            <TabsTrigger value="chips">
              <Wifi className="h-4 w-4 mr-1" /> Chips
            </TabsTrigger>
            <TabsTrigger value="veiculos">
              <Car className="h-4 w-4 mr-1" /> Veículos
            </TabsTrigger>
            <TabsTrigger value="local">
              <Package className="h-4 w-4 mr-1" /> Estoque Local
            </TabsTrigger>
          </TabsList>

          {/* Filters */}
          <div className="flex items-center gap-2 flex-wrap mt-4">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar descrição, serial, IMEI..."
                className="pl-8"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Select value={modelFilter} onValueChange={setModelFilter}>
              <SelectTrigger className="w-44">
                <SelectValue placeholder="Modelo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Modelos</SelectItem>
                {currentModels.map((m) => (
                  <SelectItem key={m} value={m}>{m}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="disponivel">Disponível</SelectItem>
                <SelectItem value="vinculado">Vinculado</SelectItem>
                <SelectItem value="inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Equipamentos tab */}
          <TabsContent value="equipamentos">
            <CadastrosTable
              icon={<Cpu className="h-8 w-8 mx-auto mb-2 opacity-50" />}
              loading={equipQuery.isLoading}
              error={equipQuery.error}
              items={equipFiltered}
              identifierLabel="Serial / IMEI"
              matchedTipo={equipQuery.data?.matched ?? null}
              availableTipos={equipQuery.data?.availableTipos ?? []}
              endpointsTried={equipQuery.data?.tried ?? []}
              candidatesTried={EQUIP_CANDIDATES}
              source={equipQuery.data?.source ?? null}
              kind="equipamento"
            />
          </TabsContent>

          {/* Chips tab */}
          <TabsContent value="chips">
            <CadastrosTable
              icon={<Wifi className="h-8 w-8 mx-auto mb-2 opacity-50" />}
              loading={chipsQuery.isLoading}
              error={chipsQuery.error}
              items={chipFiltered}
              identifierLabel="ICCID / Número"
              matchedTipo={chipsQuery.data?.matched ?? null}
              availableTipos={chipsQuery.data?.availableTipos ?? []}
              endpointsTried={chipsQuery.data?.tried ?? []}
              candidatesTried={CHIP_CANDIDATES}
              source={chipsQuery.data?.source ?? null}
              kind="chip"
            />
          </TabsContent>

          {/* Veículos tab */}
          <TabsContent value="veiculos">
            {veiculosError ? (
              <Card>
                <CardContent className="flex items-center gap-3 p-6 text-destructive">
                  <AlertCircle className="h-5 w-5" />
                  <div>
                    <p className="font-medium">Erro ao consultar veículos</p>
                    <p className="text-sm text-muted-foreground">{String(veiculosError)}</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Placa</TableHead>
                        <TableHead>Descrição</TableHead>
                        <TableHead>Modelo/Tipo</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {veiculosLoading ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8">
                            <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                          </TableCell>
                        </TableRow>
                      ) : filteredVeiculos.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                            <Car className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            Nenhum veículo encontrado.
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredVeiculos.map((v: any, i: number) => {
                          const placa = v.Placa || v.placa || "—";
                          const desc = v.Descricao || v.descricao || v.Nome || v.nome || "—";
                          const modelo = v.Modelo || v.modelo || v.TipoVeiculo || v.tipoVeiculo || "—";
                          const status = v.Status || v.status;
                          const isActive = status === "Ativo" || status === 1 || status === "1";
                          return (
                            <TableRow key={v.Key || v.key || v.Id || v.id || i}>
                              <TableCell className="font-mono font-medium">{placa}</TableCell>
                              <TableCell>{desc}</TableCell>
                              <TableCell className="text-sm">{modelo}</TableCell>
                              <TableCell>
                                <Badge
                                  variant={isActive ? "default" : "secondary"}
                                  className={isActive
                                    ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                    : "bg-muted text-muted-foreground"}
                                >
                                  {isActive ? "Ativo" : "Inativo"}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Local tab */}
          <TabsContent value="local">
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Equipamento</TableHead>
                      <TableHead>Modelo</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {localLoading ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8">
                          <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                        </TableCell>
                      </TableRow>
                    ) : filteredLocal.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                          <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          Nenhum equipamento encontrado.
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredLocal.map((item) => (
                        <TableRow key={item.id}>
                          <TableCell className="font-medium">{item.name}</TableCell>
                          <TableCell className="text-sm">{item.model || "—"}</TableCell>
                          <TableCell>
                            <Badge
                              variant={item.status === "disponivel" ? "default" : "secondary"}
                              className={item.status === "disponivel"
                                ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                                : "bg-amber-100 text-amber-700 hover:bg-amber-100"}
                            >
                              {item.status === "disponivel" ? "Disponível" : "Vinculado"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function KpiCard({ label, value, accent }: { label: string; value: number; accent?: "emerald" | "amber" | "muted" }) {
  const color =
    accent === "emerald" ? "text-emerald-600" :
    accent === "amber" ? "text-amber-600" :
    accent === "muted" ? "text-muted-foreground" : "";
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className={`text-sm font-medium ${color}`}>{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-2xl font-bold ${color}`}>{value}</p>
      </CardContent>
    </Card>
  );
}

function CadastrosTable({
  icon,
  loading,
  error,
  items,
  identifierLabel,
  matchedTipo,
  availableTipos,
  endpointsTried,
  candidatesTried,
  source,
  kind,
}: {
  icon: React.ReactNode;
  loading: boolean;
  error: unknown;
  items: CadastroItem[];
  identifierLabel: string;
  matchedTipo: string | null;
  availableTipos: string[];
  endpointsTried: Array<{ endpoint: string; status: string }>;
  candidatesTried: string[];
  source: "endpoint" | "cadastros" | "veiculos" | null;
  kind: string;
}) {
  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 p-6 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <div>
            <p className="font-medium">Erro ao consultar GSystem</p>
            <p className="text-sm text-muted-foreground">{String(error)}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Nothing found anywhere — show full diagnostic
  if (!loading && !matchedTipo && items.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="flex items-center gap-2 text-amber-600">
            <AlertCircle className="h-5 w-5" />
            <p className="font-medium">Nenhum {kind} localizado na sua base GSystem.</p>
          </div>

          {endpointsTried.length > 0 && (
            <div className="text-sm space-y-1">
              <p className="text-muted-foreground">Endpoints diretos consultados:</p>
              <div className="rounded border bg-muted/30 p-2 space-y-1 font-mono text-xs">
                {endpointsTried.map((t) => (
                  <div key={t.endpoint} className="flex justify-between gap-3">
                    <span>{t.endpoint}</span>
                    <span className="text-muted-foreground">{t.status}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Também tentei <span className="font-mono">/cadastros</span> com os tipos:{" "}
            <span className="font-mono">{candidatesTried.join(", ")}</span>
          </p>

          {availableTipos.length > 0 && (
            <div className="text-sm">
              <p className="text-muted-foreground mb-1">Tipos disponíveis em /cadastros:</p>
              <div className="flex flex-wrap gap-1">
                {availableTipos.map((t) => (
                  <Badge key={t} variant="secondary" className="font-mono text-xs">{t}</Badge>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted-foreground border-t pt-3">
            Possíveis causas: a API do seu GSystem expõe {kind}s em endpoint não-padrão, o usuário da
            integração não tem permissão de leitura nesse cadastro, ou a base realmente está vazia.
            Me envie o nome do endpoint ou tipo correto para que eu fixe a consulta.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      {matchedTipo && (
        <div className="px-4 py-2 text-xs text-muted-foreground border-b flex items-center gap-2">
          <span>Fonte:</span>
          <Badge variant="outline" className="font-mono text-xs">
            {source === "endpoint" || source === "veiculos" ? matchedTipo : `/cadastros · Tipo=${matchedTipo}`}
          </Badge>
        </div>
      )}
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{identifierLabel}</TableHead>
              <TableHead>Descrição</TableHead>
              <TableHead>Modelo</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Vínculo</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto" />
                </TableCell>
              </TableRow>
            ) : items.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  {icon}
                  Nenhum item encontrado com os filtros atuais.
                </TableCell>
              </TableRow>
            ) : (
              items.map((it) => {
                const cls = classifyStatus(it.status);
                const badgeClass =
                  cls === "disponivel" ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" :
                  cls === "vinculado" ? "bg-amber-100 text-amber-700 hover:bg-amber-100" :
                  cls === "inativo" ? "bg-muted text-muted-foreground" :
                  "bg-secondary text-secondary-foreground";
                return (
                  <TableRow key={it.key}>
                    <TableCell className="font-mono text-sm">{it.identificador || it.key || "—"}</TableCell>
                    <TableCell className="font-medium">{it.descricao || "—"}</TableCell>
                    <TableCell className="text-sm">{it.modelo || "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={badgeClass}>
                        {it.status || "—"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {typeof it.vinculo === "string" ? it.vinculo : it.vinculo ? JSON.stringify(it.vinculo) : "—"}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
