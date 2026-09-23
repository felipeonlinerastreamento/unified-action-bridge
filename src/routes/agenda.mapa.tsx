import { createFileRoute, Link } from "@tanstack/react-router";
import { ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MapPin,
  RefreshCw,
  Search,
  Users,
  Wrench,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AppLayout } from "@/components/app-layout";
import { useAuth } from "@/hooks/use-auth";
import { listarAtividades } from "@/lib/seu-instalador.functions";
import { geocodificarEnderecos } from "@/lib/geocode.functions";
import { OsDetalhesDialog } from "@/components/agenda/os-detalhes-dialog";
import type { MapPoint } from "@/components/agenda/mapa-leaflet";
import {
  asList,
  errorMessage,
  formatTime,
  osAddress,
  osCoords,
  pick,
  shiftDate,
  statusStyle,
  todayISO,
  STATUS_STYLES,
} from "@/components/agenda/shared";

const MapaLeaflet = lazy(() => import("@/components/agenda/mapa-leaflet"));

export const Route = createFileRoute("/agenda/mapa")({
  head: () => ({
    meta: [
      { title: "Agenda — Mapa de atendimentos | GSystem Hub" },
      { name: "description", content: "Mapa dos atendimentos do dia com técnico, status e endereço de cada OS." },
      { property: "og:title", content: "Agenda — Mapa de atendimentos | GSystem Hub" },
      { property: "og:description", content: "Veja no mapa todos os pontos de atendimento do dia." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AgendaMapaPage,
});

const ALL = "__all__";

type Row = {
  id: string;
  identifier: string;
  title: string;
  client: string;
  status: string;
  technician: string;
  address: string;
  time: string;
  coords: { lat: number; lng: number } | null;
  activity: any;
};

function AgendaMapaPage() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading || !isAuthenticated) return null;
  return (
    <AppLayout>
      <AgendaMapa />
    </AppLayout>
  );
}

function AgendaMapa() {
  const fetchAtividades = useServerFn(listarAtividades);
  const geocode = useServerFn(geocodificarEnderecos);
  const { hasRole } = useAuth();
  const canEdit = hasRole("admin") || hasRole("gestor");

  const [date, setDate] = useState(todayISO());
  const [search, setSearch] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [technician, setTechnician] = useState(ALL);
  const [hiddenStatus, setHiddenStatus] = useState<string[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  const query = useQuery({
    queryKey: ["agenda-mapa", date, filterSearch],
    queryFn: () =>
      fetchAtividades({
        data: {
          scheduledFrom: date,
          scheduledTo: date,
          search: filterSearch || undefined,
          page: 1,
          pageSize: 100,
        },
      }),
  });

  const allRows: Row[] = useMemo(
    () =>
      asList(query.data).map((r, i) => ({
        id: String(r.id ?? r.orderId ?? r.identifier ?? i),
        identifier: pick(r, ["identifier", "code", "os"], "—"),
        title: pick(r, ["title", "serviceTypeName", "serviceType"], "Atividade"),
        client: pick(r, ["clientName", "client", "companyName"], "—"),
        status: pick(r, ["statusName", "status"], "—"),
        technician: pick(r, ["technicianName", "technician"], "Sem técnico"),
        address: osAddress(r),
        time: formatTime(pick(r, ["scheduledAt", "scheduledDate", "startAt"], "")),
        coords: osCoords(r),
        activity: r,
      })),
    [query.data],
  );

  const technicians = useMemo(
    () =>
      Array.from(new Set(allRows.map((r) => r.technician)))
        .filter(Boolean)
        .sort((a, b) => a.localeCompare(b, "pt-BR")),
    [allRows],
  );

  const rows = useMemo(
    () =>
      allRows.filter((r) => {
        if (technician !== ALL && r.technician !== technician) return false;
        if (hiddenStatus.includes(statusStyle(r.status).key)) return false;
        return true;
      }),
    [allRows, technician, hiddenStatus],
  );

  // Endereços que precisam ser convertidos em coordenadas.
  const addressesToGeocode = useMemo(
    () =>
      Array.from(
        new Set(rows.filter((r) => !r.coords && r.address.length >= 5).map((r) => r.address)),
      ).slice(0, 40),
    [rows],
  );

  const geoQuery = useQuery({
    queryKey: ["agenda-mapa-geocode", addressesToGeocode],
    enabled: addressesToGeocode.length > 0,
    staleTime: 1000 * 60 * 30,
    queryFn: () => geocode({ data: { addresses: addressesToGeocode } }),
  });

  const geoMap = useMemo(() => {
    const m = new Map<string, { lat: number; lng: number }>();
    for (const g of geoQuery.data ?? []) {
      if (g.lat != null && g.lng != null) m.set(g.address, { lat: g.lat, lng: g.lng });
    }
    return m;
  }, [geoQuery.data]);

  const located: MapPoint[] = useMemo(() => {
    const out: MapPoint[] = [];
    for (const r of rows) {
      const c = r.coords ?? geoMap.get(r.address) ?? null;
      if (!c) continue;
      out.push({
        id: r.id,
        lat: c.lat,
        lng: c.lng,
        color: statusStyle(r.status).hex,
        statusLabel: r.status,
        identifier: r.identifier,
        title: r.title,
        client: r.client,
        technician: r.technician,
        time: r.time,
        address: r.address || "Sem endereço",
        activity: r.activity,
      });
    }
    return out;
  }, [rows, geoMap]);

  const locatedIds = useMemo(() => new Set(located.map((p) => p.id)), [located]);
  const withoutLocation = useMemo(() => rows.filter((r) => !locatedIds.has(r.id)), [rows, locatedIds]);

  useEffect(() => {
    setSelectedId(null);
  }, [date]);

  const toggleStatus = (key: string) =>
    setHiddenStatus((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Agenda & Campo</h1>
          <p className="text-sm text-muted-foreground">Pontos de atendimento do dia, por técnico e status</p>
        </div>
        <div className="flex items-center gap-2">
          <Link to="/agenda/atividades">
            <Button variant="outline" size="sm" className="gap-2">
              <Calendar className="w-4 h-4" />
              Atividades
            </Button>
          </Link>
          <Link to="/agenda/timeline">
            <Button variant="outline" size="sm" className="gap-2">
              <Clock className="w-4 h-4" />
              Timeline
            </Button>
          </Link>
          <Link to="/agenda/mapa">
            <Button variant="default" size="sm" className="gap-2">
              <MapPin className="w-4 h-4" />
              Mapa
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" onClick={() => setDate((d) => shiftDate(d, -1))}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-[170px]" />
        <Button variant="outline" size="icon" onClick={() => setDate((d) => shiftDate(d, 1))}>
          <ChevronRight className="w-4 h-4" />
        </Button>
        <Button variant="outline" size="sm" onClick={() => setDate(todayISO())}>
          Hoje
        </Button>
        <Button variant="outline" size="sm" className="gap-2" onClick={() => query.refetch()}>
          <RefreshCw className={`w-4 h-4 ${query.isFetching ? "animate-spin" : ""}`} />
          Atualizar
        </Button>

        <div className="flex flex-wrap items-center gap-2 ml-auto">
          {STATUS_STYLES.map((s) => {
            const off = hiddenStatus.includes(s.key);
            return (
              <button
                key={s.key}
                type="button"
                onClick={() => toggleStatus(s.key)}
                className={`flex items-center gap-1.5 text-xs rounded-full border px-2.5 py-1 transition-opacity ${off ? "opacity-40" : ""}`}
              >
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: s.hex }} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="h-[calc(100vh-18rem)] min-h-[480px] flex flex-col md:flex-row gap-4">
        <Card className="w-full md:w-80 flex flex-col h-full shrink-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Filtros do Mapa</CardTitle>
            <CardDescription className="text-xs">Busque serviços e técnicos na região</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4 flex-1 overflow-hidden">
            <div className="space-y-1.5">
              <Label className="text-xs">Localizar</Label>
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Cliente, OS, endereço..."
                  className="pl-9 text-xs h-9"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && setFilterSearch(search)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Técnico em Campo</Label>
              <Select value={technician} onValueChange={setTechnician}>
                <SelectTrigger className="h-9 text-xs">
                  <SelectValue placeholder="Todos os técnicos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL}>Todos os técnicos</SelectItem>
                  {technicians.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button size="sm" className="w-full mt-1" onClick={() => setFilterSearch(search)}>
              Aplicar Filtros
            </Button>

            <div className="mt-2 border-t pt-3 flex-1 flex flex-col min-h-0">
              <h4 className="text-xs font-semibold mb-2 flex items-center justify-between">
                Destaques na Região
                <div className="text-[10px] font-normal text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                  {query.isFetching ? <Loader2 className="w-3 h-3 animate-spin" /> : rows.length}
                </div>
              </h4>
              <ScrollArea className="flex-1 pr-2">
                {query.isLoading ? (
                  <div className="flex flex-col items-center justify-center text-muted-foreground py-8 gap-2">
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span className="text-xs">Carregando dados...</span>
                  </div>
                ) : query.isError ? (
                  <div className="flex flex-col items-center justify-center text-destructive py-8 gap-2 text-center">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-xs">{errorMessage(query.error) || "Falha ao carregar"}</span>
                  </div>
                ) : rows.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground py-6">
                    Nenhuma atividade encontrada com os filtros atuais.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {rows.map((r) => {
                      const st = statusStyle(r.status);
                      const noLoc = !locatedIds.has(r.id);
                      return (
                        <div
                          key={r.id}
                          onClick={() => {
                            setSelectedId(r.id);
                            if (noLoc) setDetail(r.activity);
                          }}
                          className={`p-2.5 border rounded-md text-xs bg-card hover:bg-accent/50 transition-colors cursor-pointer ${selectedId === r.id ? "ring-2 ring-primary" : ""}`}
                        >
                          <div className="font-medium flex items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 min-w-0">
                              <Wrench className="w-3.5 h-3.5 shrink-0" style={{ color: st.hex }} />
                              <span className="truncate">
                                {r.identifier !== "—" ? `OS ${r.identifier}` : r.title}
                              </span>
                            </span>
                            <span className="shrink-0 text-[10px] text-muted-foreground">{r.time}</span>
                          </div>
                          <div className="text-muted-foreground mt-1 text-[11px] truncate" title={r.address}>
                            {r.address || "Sem endereço"}
                          </div>
                          <div className="flex items-center gap-1.5 mt-1.5 text-[11px]">
                            <Users className="w-3 h-3 text-primary shrink-0" />
                            <span className="font-medium truncate text-primary/80">{r.technician}</span>
                          </div>
                          <div className="mt-1 font-medium text-[10px] text-muted-foreground">
                            Status: <span className="text-foreground">{r.status}</span>
                            {noLoc && <span className="ml-1 text-destructive">· sem localização</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </ScrollArea>
              <div className="pt-2 mt-2 border-t text-[11px] text-muted-foreground">
                {located.length} no mapa
                {withoutLocation.length > 0 && ` · ${withoutLocation.length} sem localização`}
                {geoQuery.isFetching && (
                  <span className="ml-1 inline-flex items-center gap-1">
                    <Loader2 className="w-3 h-3 animate-spin" /> localizando endereços...
                  </span>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex-1 rounded-xl overflow-hidden border relative min-h-[400px]">
          <ClientOnly
            fallback={
              <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            }
          >
            <Suspense
              fallback={
                <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              }
            >
              <MapaLeaflet
                points={located}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onOpenDetails={(a) => setDetail(a)}
              />
            </Suspense>
          </ClientOnly>
        </div>
      </div>

      <OsDetalhesDialog
        open={!!detail}
        onClose={() => setDetail(null)}
        activity={detail}
        canEdit={canEdit}
        onUpdated={() => query.refetch()}
      />
    </div>
  );
}
