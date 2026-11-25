import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { FEATURES, useFeatures } from "@/lib/ge/features";
import { FeatureGate } from "@/components/ge/feature-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Stethoscope, AlertTriangle, CheckCircle2, Clock, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { eventRuleKey } from "@/lib/ge/event-types";
import { resolveEventDriver } from "@/lib/ge/driver-resolution";
import { getSyncDiagnostics } from "@/lib/ge/sync-diagnostics.functions";

export const Route = createFileRoute("/gestao-eventos/eventos/")({
  component: EventsPage,
});

function EventsPage() {
  return (
    <FeatureGate feature={FEATURES.events}>
      <EventsList />
    </FeatureGate>
  );
}

type TreatmentFilter = "untreated" | "treated" | "all";

const TREATMENT_STATUS_MAP: Record<TreatmentFilter, ("pending" | "in_treatment" | "treated" | "closed")[] | null> = {
  untreated: ["pending", "in_treatment"],
  treated: ["treated", "closed"],
  all: null,
};

function EventsList() {
  const { profile } = useAuth();
  const { has } = useFeatures();
  const showFatigue = has(FEATURES.eventsFatigue);
  const clientId = profile?.client_id ?? null;
  const [search, setSearch] = useState("");
  const [riskFilter, setRiskFilter] = useState<string>("all");
  const [treatmentFilter, setTreatmentFilter] = useState<TreatmentFilter>("untreated");
  const [analysisFilter, setAnalysisFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [colType, setColType] = useState("all");
  const [colDriver, setColDriver] = useState("all");
  const [colPlate, setColPlate] = useState("all");
  const [colFleet, setColFleet] = useState("all");
  const [colRisk, setColRisk] = useState("all");
  const [colStatus, setColStatus] = useState("all");
  const [colPlatform, setColPlatform] = useState("all");
  const queryClient = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("events-realtime")
      .on(
        "postgres_changes",
        clientId
          ? { event: "*", schema: "public", table: "events", filter: `client_id=eq.${clientId}` }
          : { event: "*", schema: "public", table: "events" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["events"] });
          queryClient.invalidateQueries({ queryKey: ["events-stats"] });
        },
      )
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") {
          console.warn("events realtime channel status:", status);
        }
      });
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient, clientId]);

  const { data: events, isLoading, error: eventsError } = useQuery({
    queryKey: ["events", clientId, riskFilter, treatmentFilter, analysisFilter, dateFrom, dateTo, showFatigue, colStatus],
    queryFn: async () => {
      let q = supabase.from("ge_events").select("*, event_analyses:ge_event_analyses(id)").order("event_time", { ascending: false }).limit(200);
      if (clientId) q = q.eq("client_id", clientId);
      // Fadiga só quando liberada para a base (regra central em useFeatures)
      if (!showFatigue) q = q.neq("api_source", "yuv");
      if (riskFilter !== "all") q = q.eq("risk_level", riskFilter as "none" | "low" | "medium" | "high" | "critical");
      if (colStatus !== "all") {
        q = q.eq("status", colStatus as "pending" | "in_treatment" | "treated" | "closed");
      } else {
        const statuses = TREATMENT_STATUS_MAP[treatmentFilter];
        if (statuses) q = q.in("status", statuses);
      }
      if (dateFrom) q = q.gte("event_time", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("event_time", `${dateTo}T23:59:59`);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).filter((e) => {
        const analyzed = Array.isArray(e.event_analyses) && e.event_analyses.length > 0;
        if (analysisFilter === "analyzed") return analyzed;
        if (analysisFilter === "pending") return !analyzed;
        return true;
      });
    },
  });

  const { data: configuredTypes } = useQuery({
    queryKey: ["configured-event-types", clientId, showFatigue],
    queryFn: async () => {
      let q = supabase.from("ge_risk_configurations").select("client_id,event_type,category").eq("is_active", true);
      if (clientId) q = q.eq("client_id", clientId);
      if (!showFatigue) q = q.or("category.is.null,category.neq.fatigue");
      const { data, error } = await q;
      if (error) throw error;
      return new Set((data ?? []).map((r) => eventRuleKey(r.client_id, r.event_type)));
    },
  });


  // Frotas acessíveis (RLS já limita às frotas do usuário responsável)
  const { data: fleets } = useQuery({
    queryKey: ["events-fleets", clientId],
    queryFn: async () => {
      let q = supabase.from("ge_fleets").select("id,client_id,name,location_name,city,state");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  // Cadastro de motoristas do cliente: fonte única da identificação nos eventos
  const { data: drivers } = useQuery({
    queryKey: ["client-drivers-list", clientId],
    queryFn: async () => {
      let q = supabase.from("ge_drivers").select("id,client_id,full_name,cpf,license_plate,is_active");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["events-stats", clientId, showFatigue, configuredTypes ? Array.from(configuredTypes).sort().join(",") : ""],
    enabled: !!configuredTypes,
    queryFn: async () => {
      let q = supabase
        .from("ge_events")
        .select("id,client_id,status,risk_level,event_type,event_time")
        .order("event_time", { ascending: false })
        .limit(1000);
      if (clientId) q = q.eq("client_id", clientId);
      if (!showFatigue) q = q.neq("api_source", "yuv");
      const { data } = await q;

      const list = (data ?? []).filter((e) => configuredTypes!.has(eventRuleKey(e.client_id, e.event_type)));
      return {
        total: list.length,
        pending: list.filter((e) => e.status === "pending").length,
        inTreatment: list.filter((e) => e.status === "in_treatment").length,
        treated: list.filter((e) => e.status === "treated" || e.status === "closed").length,
        high: list.filter((e) => e.risk_level === "high").length,
      };
    },
  });

  const fetchDiagnostics = useServerFn(getSyncDiagnostics);
  const { data: diagnostics } = useQuery({
    queryKey: ["sync-diagnostics"],
    queryFn: () => fetchDiagnostics(),
    refetchInterval: 120_000,
    retry: false,
  });

  useEffect(() => {
    if (!diagnostics?.authorized || diagnostics.issues.length === 0) return;
    for (const issue of diagnostics.issues) {
      toast.error(`Falha na atualização de eventos (${issue.apiType})`, {
        id: `sync-issue-${issue.apiType}-${issue.clientName ?? ""}`,
        description: `${issue.clientName ? `${issue.clientName}: ` : ""}${issue.message}`,
        duration: 10_000,
      });
    }
  }, [diagnostics]);

  useEffect(() => {
    if (!eventsError || !diagnostics?.authorized) return;
    toast.error("Falha ao consultar eventos", {
      id: "events-query-error",
      description: eventsError instanceof Error ? eventsError.message : String(eventsError),
      duration: 10_000,
    });
  }, [eventsError, diagnostics?.authorized]);

  const statCards = [
    { label: "Total de Eventos", value: stats?.total ?? 0, icon: TrendingUp, color: "text-primary" },
    { label: "Pendentes", value: stats?.pending ?? 0, icon: Clock, color: "text-risk-medium" },
    { label: "Em Tratativa", value: stats?.inTreatment ?? 0, icon: AlertTriangle, color: "text-primary" },
    { label: "Tratados", value: stats?.treated ?? 0, icon: CheckCircle2, color: "text-risk-low" },
  ];

  const all = (events ?? []).filter((e) =>
    configuredTypes ? configuredTypes.has(eventRuleKey(e.client_id, e.event_type)) : false,
  );

  const driverNameFor = (e: { client_id: string; driver_ref_id?: string | null; driver_id?: string | null; driver_name?: string | null; license_plate?: string | null }) =>
    resolveEventDriver(e, drivers)?.full_name ?? e.driver_name ?? null;

  const fleetNameFor = (e: { fleet_id?: string | null }) =>
    (fleets ?? []).find((f) => f.id === e.fleet_id)?.name ?? null;

  const uniq = (vals: (string | null)[]) =>
    Array.from(new Set(vals.filter((v): v is string => !!v))).sort((a, b) => a.localeCompare(b));
  const typeOptions = uniq(all.map((e) => e.event_type));
  const driverOptions = uniq(all.map((e) => driverNameFor(e)));
  const plateOptions = uniq(all.map((e) => e.license_plate));
  const fleetOptions = uniq(all.map((e) => fleetNameFor(e)));

  const filtered = all.filter((e) => {
    if (!showFatigue && e.api_source === "yuv") return false;
    if (colType !== "all" && e.event_type !== colType) return false;
    if (colDriver !== "all" && (driverNameFor(e) ?? "") !== colDriver) return false;
    if (colPlate !== "all" && (e.license_plate ?? "") !== colPlate) return false;
    if (colFleet !== "all" && (fleetNameFor(e) ?? "") !== colFleet) return false;
    if (colRisk !== "all" && e.risk_level !== colRisk) return false;
    if (colStatus !== "all" && e.status !== colStatus) return false;
    if (colPlatform !== "all" && e.api_source !== colPlatform) return false;
    if (!search) return true;
    const s = search.toLowerCase();
    return (
      (driverNameFor(e)?.toLowerCase().includes(s) ?? false) ||
      (e.license_plate?.toLowerCase().includes(s) ?? false) ||
      (e.device_imei?.toLowerCase().includes(s) ?? false)
    );
  });


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Eventos</h1>
        <p className="text-sm text-muted-foreground">
          {showFatigue ? "Lista de eventos de telemetria e fadiga" : "Lista de eventos de telemetria"}
        </p>
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((c) => (
          <Card key={c.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
              <c.icon className={`h-4 w-4 ${c.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{c.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Eventos de Alto Risco</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-4xl font-bold text-risk-high">{stats?.high ?? 0}</div>
          <p className="mt-1 text-sm text-muted-foreground">Eventos que requerem atenção imediata</p>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Buscar por motorista, placa ou IMEI" value={search} onChange={(e) => setSearch(e.target.value)} />
          <Select value={riskFilter} onValueChange={setRiskFilter}>
            <SelectTrigger><SelectValue placeholder="Risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os riscos</SelectItem>
              <SelectItem value="none">Nenhum</SelectItem>
              <SelectItem value="low">Leve</SelectItem>
              <SelectItem value="medium">Moderado</SelectItem>
              <SelectItem value="high">Grave</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={treatmentFilter} onValueChange={(v) => { setTreatmentFilter(v as TreatmentFilter); setColStatus("all"); }}>
            <SelectTrigger><SelectValue placeholder="Tratativa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="untreated">Não tratados</SelectItem>
              <SelectItem value="treated">Tratados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
          <Select value={analysisFilter} onValueChange={(v) => setAnalysisFilter(v as typeof analysisFilter)}>
            <SelectTrigger><SelectValue placeholder="Análise" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Análise: todos</SelectItem>
              <SelectItem value="analyzed">Analisados</SelectItem>
              <SelectItem value="pending">Pendente análise</SelectItem>
            </SelectContent>
          </Select>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">De</label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">Até</label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Motorista</TableHead>
                <TableHead>Placa</TableHead>
                <TableHead>Frota</TableHead>
                <TableHead>Risco</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Plataforma</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
              <TableRow className="hover:bg-transparent">
                <TableHead />
                <TableHead><ColFilter value={colType} onChange={setColType} placeholder="Tipo" options={typeOptions.map((v) => ({ value: v, label: v }))} /></TableHead>
                <TableHead><ColFilter value={colDriver} onChange={setColDriver} placeholder="Motorista" options={driverOptions.map((v) => ({ value: v, label: v }))} /></TableHead>
                <TableHead><ColFilter value={colPlate} onChange={setColPlate} placeholder="Placa" options={plateOptions.map((v) => ({ value: v, label: v }))} /></TableHead>
                <TableHead><ColFilter value={colFleet} onChange={setColFleet} placeholder="Frota" options={fleetOptions.map((v) => ({ value: v, label: v }))} /></TableHead>
                <TableHead><ColFilter value={colRisk} onChange={setColRisk} placeholder="Risco" options={[
                  { value: "none", label: "Nenhum" },
                  { value: "low", label: "Leve" },
                  { value: "medium", label: "Moderado" },
                  { value: "high", label: "Grave" },
                  { value: "critical", label: "Crítico" },
                ]} /></TableHead>
                <TableHead><ColFilter value={colStatus} onChange={(v) => {
                  setColStatus(v);
                  if (v === "treated" || v === "closed") setTreatmentFilter("treated");
                  else if (v === "pending" || v === "in_treatment") setTreatmentFilter("untreated");
                }} placeholder="Status" options={[
                  { value: "pending", label: "Pendente" },
                  { value: "in_treatment", label: "Em tratativa" },
                  { value: "treated", label: "Tratado" },
                  { value: "closed", label: "Fechado" },
                ]} /></TableHead>
                <TableHead><ColFilter value={colPlatform} onChange={setColPlatform} placeholder="Plataforma" options={[
                  ...(showFatigue ? [{ value: "yuv", label: "Fadiga" }] : []),
                  { value: "movias", label: "Telemetria" },
                ]} /></TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>

            <TableBody>
              {isLoading && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Carregando...</TableCell></TableRow>
              )}
              {!isLoading && filtered.length === 0 && (
                <TableRow><TableCell colSpan={9} className="py-8 text-center text-muted-foreground">Nenhum evento encontrado.</TableCell></TableRow>
              )}
              {filtered.map((e) => (
                <TableRow key={e.id} className={riskRowClass(e.risk_level)}>
                  <TableCell className="text-sm">{format(new Date(e.event_time), "dd/MM/yyyy HH:mm")}</TableCell>
                  <TableCell><Badge variant="outline">{e.event_type}</Badge></TableCell>
                  <TableCell>{driverNameFor(e) ?? "Não identificado"}</TableCell>
                  <TableCell>{e.license_plate ?? "—"}</TableCell>
                  <TableCell className="text-sm">{fleetNameFor(e) ?? "—"}</TableCell>
                  <TableCell><RiskBadge level={e.risk_level} /></TableCell>
                  <TableCell><StatusBadge status={e.status} /></TableCell>
                  <TableCell><PlatformBadge source={e.api_source} /></TableCell>
                  <TableCell>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button asChild size="icon" variant="ghost">
                            <a href={`/gestao-eventos/eventos/${e.id}`} target="_blank" rel="noreferrer" aria-label="Iniciar tratativa">
                              <Stethoscope className="h-4 w-4" />
                            </a>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Iniciar tratativa (nova aba)</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function riskRowClass(level: string): string {
  switch (level) {
    case "low": return "bg-risk-low/10 hover:bg-risk-low/15";
    case "medium": return "bg-risk-medium/15 hover:bg-risk-medium/25";
    case "high": return "bg-risk-high/15 hover:bg-risk-high/25";
    case "critical": return "bg-destructive/20 hover:bg-destructive/30";
    default: return "";
  }
}

function RiskBadge({ level }: { level: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    none: { label: "Nenhum", cls: "bg-muted text-muted-foreground" },
    low: { label: "Leve", cls: "bg-risk-low text-white" },
    medium: { label: "Moderado", cls: "bg-risk-medium text-white" },
    high: { label: "Grave", cls: "bg-risk-high text-white" },
    critical: { label: "Crítico", cls: "bg-destructive text-destructive-foreground" },
  };
  const v = map[level] ?? map.low;
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-semibold ${v.cls}`}>{v.label}</span>;
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "Pendente",
    in_treatment: "Em tratativa",
    treated: "Tratado",
    closed: "Fechado",
  };
  return <Badge variant="secondary">{map[status] ?? status}</Badge>;
}

function PlatformBadge({ source }: { source: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    yuv: { label: "Fadiga", cls: "bg-primary/15 text-primary" },
    movias: { label: "Telemetria", cls: "bg-accent/15 text-accent-foreground" },
  };
  const v = map[source] ?? { label: source, cls: "bg-muted text-muted-foreground" };
  return <span className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${v.cls}`}>{v.label}</span>;
}

function ColFilter({
  value,
  onChange,
  placeholder,
  options,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  options: { value: string; label: string }[];
}) {
  return (
    <Select value={value} onValueChange={onChange}>
      <SelectTrigger className="h-8 text-xs font-normal">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all">Todos</SelectItem>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
