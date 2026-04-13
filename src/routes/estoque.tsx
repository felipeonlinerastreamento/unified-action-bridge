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
import { getVeiculos, getVeiculoTipos } from "@/lib/gsystem-api.functions";
import { Search, Package, Car, RefreshCw, Loader2, AlertCircle } from "lucide-react";

export const Route = createFileRoute("/estoque")({
  component: EstoquePage,
});

type InventoryItem = {
  id: string;
  name: string;
  model: string | null;
  status: "disponivel" | "vinculado";
};

function EstoquePage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [modelFilter, setModelFilter] = useState<string>("all");
  const [tab, setTab] = useState("gsystem");

  const getAuthHeaders = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return { headers: { authorization: `Bearer ${session?.access_token}` } };
  }, []);

  // GSystem Veículos
  const { data: veiculos = [], isLoading: veiculosLoading, error: veiculosError, refetch: refetchVeiculos } = useQuery({
    queryKey: ["gsystem-veiculos"],
    queryFn: async () => {
      const result = await getVeiculos({
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : result?.data || result?.Data || [];
    },
    enabled: isAuthenticated && tab === "gsystem",
    retry: 1,
  });

  // Vehicle types
  const { data: veiculoTipos = [] } = useQuery({
    queryKey: ["gsystem-veiculo-tipos"],
    queryFn: async () => {
      const result = await getVeiculoTipos({
        ...await getAuthHeaders(),
      });
      return Array.isArray(result) ? result : [];
    },
    enabled: isAuthenticated && tab === "gsystem",
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

  // Unique models from GSystem data
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
      (statusFilter === "ativo" && (status === "Ativo" || status === 1 || status === "1")) ||
      (statusFilter === "inativo" && (status === "Inativo" || status === 0 || status === "0"));
    return matchesSearch && matchesModel && matchesStatus;
  });

  // Filter local items
  const filteredLocal = localItems.filter((item) => {
    const matchesSearch = !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.model && item.model.toLowerCase().includes(search.toLowerCase()));
    const matchesStatus = statusFilter === "all" || item.status === statusFilter;
    const matchesModel = modelFilter === "all" || item.model === modelFilter;
    return matchesSearch && matchesStatus && matchesModel;
  });

  const currentModels = tab === "gsystem" ? gsystemModels : localModels;
  const currentLoading = tab === "gsystem" ? veiculosLoading : localLoading;
  const totalCount = tab === "gsystem" ? filteredVeiculos.length : filteredLocal.length;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Consulta de Estoque</h1>
            <p className="text-sm text-muted-foreground">Consulte equipamentos e veículos</p>
          </div>
          {tab === "gsystem" && (
            <Button variant="outline" size="sm" onClick={() => refetchVeiculos()} disabled={veiculosLoading}>
              <RefreshCw className={`h-4 w-4 ${veiculosLoading ? "animate-spin" : ""}`} />
            </Button>
          )}
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Total</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{totalCount}</p>
            </CardContent>
          </Card>
          {tab === "gsystem" ? (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-600">Veículos (GSystem)</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-600">{veiculos.length}</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">Tipos</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold">{veiculoTipos.length}</p>
                </CardContent>
              </Card>
            </>
          ) : (
            <>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-emerald-600">Disponíveis</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-emerald-600">
                    {filteredLocal.filter((i) => i.status === "disponivel").length}
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-amber-600">Vinculados</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-bold text-amber-600">
                    {filteredLocal.filter((i) => i.status === "vinculado").length}
                  </p>
                </CardContent>
              </Card>
            </>
          )}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="gsystem">
              <Car className="h-4 w-4 mr-1" /> Veículos (GSystem)
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
                placeholder="Buscar..."
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
                {tab === "gsystem" ? (
                  <>
                    <SelectItem value="ativo">Ativo</SelectItem>
                    <SelectItem value="inativo">Inativo</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="disponivel">Disponível</SelectItem>
                    <SelectItem value="vinculado">Vinculado</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* GSystem tab */}
          <TabsContent value="gsystem">
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
                      {currentLoading ? (
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
