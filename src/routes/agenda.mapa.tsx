import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Search, Users, Wrench, MapPin, Loader2, AlertTriangle } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listarAtividades } from "@/lib/seu-instalador.functions";
import { asList, pick, todayISO, shiftDate, errorMessage } from "@/components/agenda/shared";

export const Route = createFileRoute("/agenda/mapa")({
  component: AgendaMapa
});

const ALL = "__all__";

function AgendaMapa() {
  const fetchAtividades = useServerFn(listarAtividades);
  const [search, setSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [technician, setTechnician] = useState(ALL);

  // Busca um intervalo razoável para exibir em mapa (7 dias antes e depois)
  const from = shiftDate(todayISO(), -7);
  const to = shiftDate(todayISO(), 7);

  const query = useQuery({
    queryKey: ["map-activities", from, to, filterSearch],
    queryFn: () =>
      fetchAtividades({
        data: {
          scheduledFrom: from,
          scheduledTo: to,
          search: filterSearch || undefined,
          page: 1,
          pageSize: 100, // traz amostra suficiente pro mapa
        },
      }),
  });

  const allRows = useMemo(() => asList(query.data).map(r => ({
    id: String(r.id ?? r.orderId ?? ""),
    identifier: pick(r, ["identifier", "code", "os"], "—"),
    title: pick(r, ["title", "serviceTypeName", "serviceType"], "Atividade"),
    status: pick(r, ["statusName", "status"], "—"),
    technician: pick(r, ["technicianName", "technician"], "Sem técnico"),
    address: pick(r, ["address", "endereco"], "Sem endereço"),
  })), [query.data]);

  const technicians = useMemo(
    () => Array.from(new Set(allRows.map((r) => r.technician).filter(t => t !== "Sem técnico"))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allRows],
  );

  const rows = useMemo(
    () =>
      allRows.filter(
        (r) => (technician === ALL || r.technician === technician)
      ),
    [allRows, technician],
  );

  const applyFilters = () => {
    setFilterSearch(search);
  };

  return (
    <div className="h-full min-h-[calc(100vh-5rem)] flex flex-col md:flex-row gap-4 p-4 md:p-6 bg-background">
      <Card className="w-full md:w-80 flex flex-col h-full shrink-0 shadow-sm">
        <CardHeader>
          <CardTitle>Filtros do Mapa</CardTitle>
          <CardDescription>Busque serviços e técnicos na região</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-5 flex-1">
          <div className="space-y-2">
            <Label>Localizar</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder="Cliente, OS, endereço..." 
                className="pl-9" 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
              />
            </div>
          </div>
          
          <div className="space-y-2">
            <Label>Técnico em Campo</Label>
            <Select value={technician} onValueChange={setTechnician}>
              <SelectTrigger>
                <SelectValue placeholder="Todos os técnicos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os técnicos</SelectItem>
                {technicians.map((t) => (
                  <SelectItem key={t} value={t}>{t}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button className="w-full mt-2" onClick={applyFilters}>
            Aplicar Filtros
          </Button>

          <div className="mt-4 border-t pt-4 pb-2 flex-1 flex flex-col">
            <h4 className="text-sm font-semibold mb-3 flex items-center justify-between">
              Destaques na Região
              <div className="text-xs font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                {query.isFetching ? <Loader2 className="w-3 h-3 animate-spin"/> : rows.length}
              </div>
            </h4>
            <ScrollArea className="h-[200px] w-full flex-1 pr-3">
              {query.isLoading ? (
                <div className="flex flex-col items-center justify-center text-muted-foreground h-full gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-xs">Carregando dados...</span>
                </div>
              ) : query.isError ? (
                <div className="flex flex-col items-center justify-center text-destructive h-full gap-2 text-center">
                  <AlertTriangle className="w-5 h-5" />
                  <span className="text-xs">{errorMessage(query.error) || "Falha ao carregar"}</span>
                </div>
              ) : rows.length === 0 ? (
                <div className="text-center text-xs text-muted-foreground mt-4">
                  Nenhuma atividade encontrada com os filtros atuais.
                </div>
              ) : (
                <div className="space-y-3">
                  {rows.map((r, i) => (
                    <div key={r.id || i} className="p-3 border rounded-md text-sm bg-card hover:bg-accent/50 transition-colors cursor-pointer">
                      <div className="font-medium flex items-center justify-between gap-2">
                        <span className="flex items-center gap-1.5 min-w-0">
                          <Wrench className="w-4 h-4 text-orange-500 shrink-0"/> 
                          <span className="truncate">{r.identifier !== "—" ? `OS ${r.identifier}` : r.title}</span>
                        </span>
                      </div>
                      <div className="text-muted-foreground mt-1 text-xs truncate" title={r.address}>
                        {r.address}
                      </div>
                      <div className="flex items-center gap-1.5 mt-2 text-xs">
                        <Users className="w-3 h-3 text-primary shrink-0"/> 
                        <span className="font-medium truncate text-primary/80">{r.technician}</span>
                      </div>
                      <div className="mt-1 font-medium text-[11px] text-muted-foreground">
                        Status: <span className="text-foreground">{r.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </CardContent>
      </Card>

      <div className="flex-1 bg-muted/40 border border-dashed rounded-xl overflow-hidden relative flex flex-col items-center justify-center text-muted-foreground min-h-[400px]">
        <div className="animate-pulse flex flex-col items-center">
          <MapPin className="w-16 h-16 mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-semibold mb-2">Área do Mapa</h3>
          <p className="max-w-md text-center text-sm px-4">
            Interface preparada para exibição da localização georreferenciada de técnicos e pontos de serviço em tempo real.
            <br/><br/>
            Os filtros laterais já estão conectados via API. A visão interativa receberá integração futura com o provedor de mapas.
          </p>
        </div>
      </div>
    </div>
  );
}
