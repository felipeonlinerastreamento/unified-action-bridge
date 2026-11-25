import { createFileRoute } from "@tanstack/react-router";
import { FEATURES, useFeatures } from "@/lib/ge/features";
import { FeatureGate } from "@/components/ge/feature-gate";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { resolveEventDriver } from "@/lib/ge/driver-resolution";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { format } from "date-fns";
import { Download, FileDown } from "lucide-react";
import { toast } from "sonner";
import { generateCombinedTreatmentPdf, generateReportPdf, type TreatmentPdfPayload } from "@/lib/ge/event-pdf";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/gestao-eventos/relatorio")({
  component: OperationalReportGated,
});

const EVENT_TYPE_LABELS: Record<string, string> = {
  speeding: "Excesso de velocidade",
  acceleration: "Aceleração brusca",
  harsh_braking: "Frenagem brusca",
  yawning: "Bocejo",
  eyes_closed: "Olhos fechados",
  distraction: "Distração",
};

const RISK_LABELS: Record<string, string> = {
  none: "Nenhum",
  low: "Leve",
  medium: "Moderado",
  high: "Grave",
  critical: "Crítico",
};

type TreatmentFilter = "all" | "untreated" | "treated";
const TREATMENT_STATUS_MAP: Record<TreatmentFilter, ("pending" | "in_treatment" | "treated" | "closed")[] | null> = {
  untreated: ["pending", "in_treatment"],
  treated: ["treated", "closed"],
  all: null,
};

function extractField(data: unknown, keys: string[]): string | null {
  if (!data || typeof data !== "object") return null;
  const obj = data as Record<string, unknown>;
  for (const k of keys) {
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase() === k.toLowerCase()) {
        const v = obj[key];
        if (v != null && v !== "") return String(v);
      }
    }
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const found = extractField(v, keys);
      if (found) return found;
    }
  }
  return null;
}

const COLUMNS = [
  { key: "data", label: "Data" },
  { key: "tipo", label: "Tipo" },
  { key: "motorista", label: "Motorista" },
  { key: "placa", label: "Placa" },
  { key: "risco", label: "Risco" },
  { key: "status", label: "Status" },
  { key: "tratativa", label: "Tratativa" },
  { key: "respTratativa", label: "Responsável tratativa" },
  { key: "respAnalise", label: "Responsável análise" },
] as const;
type ColKey = (typeof COLUMNS)[number]["key"];

function OperationalReport() {
  const { profile } = useAuth();
  const { has } = useFeatures();
  const showFatigue = has(FEATURES.eventsFatigue);
  const clientId = profile?.client_id ?? null;
  const [plate, setPlate] = useState("");
  const [driver, setDriver] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [risk, setRisk] = useState<string>("all");
  const [treatmentFilter, setTreatmentFilter] = useState<TreatmentFilter>("all");
  const [analysisFilter, setAnalysisFilter] = useState<"all" | "analyzed" | "pending">("all");
  const [cols, setCols] = useState<ColKey[]>(COLUMNS.map((c) => c.key));

  const { data: rows } = useQuery({
    queryKey: ["report-operational", clientId, plate, driver, dateFrom, dateTo, risk, treatmentFilter, showFatigue],
    queryFn: async () => {
      let q = supabase
        .from("ge_events")
        .select("id,client_id,api_source,event_time,event_type,driver_ref_id,driver_id,driver_name,license_plate,risk_level,status,latitude,longitude,event_data,treatments:ge_treatments(treatment_description,created_at,treatment_status,created_by_user_id),event_analyses:ge_event_analyses(analyzed_by_user_id,created_at)")
        .order("event_time", { ascending: false })
        .limit(500);
      if (clientId) q = q.eq("client_id", clientId);
      // Eventos de fadiga só entram no relatório (e na exportação) quando a
      // funcionalidade está liberada para a base.
      if (!showFatigue) q = q.neq("api_source", "yuv");
      if (plate.trim()) q = q.ilike("license_plate", `%${plate.trim()}%`);
      if (dateFrom) q = q.gte("event_time", `${dateFrom}T00:00:00`);
      if (dateTo) q = q.lte("event_time", `${dateTo}T23:59:59`);
      if (risk !== "all") q = q.eq("risk_level", risk as "none" | "low" | "medium" | "high" | "critical");
      const statuses = TREATMENT_STATUS_MAP[treatmentFilter];
      if (statuses) q = q.in("status", statuses);
      const { data } = await q;
      const list = (data ?? []).filter((r) => showFatigue || r.api_source !== "yuv");
      const ids = new Set<string>();
      list.forEach((r) => {
        (r.treatments ?? []).forEach((t) => t.created_by_user_id && ids.add(t.created_by_user_id));
        (r.event_analyses ?? []).forEach((a) => a.analyzed_by_user_id && ids.add(a.analyzed_by_user_id));
      });
      const names = new Map<string, string>();
      if (ids.size) {
        const { data: ps } = await supabase.from("ge_profiles").select("id,full_name,email").in("id", Array.from(ids));
        (ps ?? []).forEach((p) => names.set(p.id, p.full_name || p.email));
      }
      return list.map((r) => {
        const t = [...(r.treatments ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
        const a = [...(r.event_analyses ?? [])].sort((x, y) => y.created_at.localeCompare(x.created_at))[0];
        return {
          ...r,
          treatmentAuthor: t ? names.get(t.created_by_user_id) ?? "—" : "",
          analysisAuthor: a ? names.get(a.analyzed_by_user_id) ?? "—" : "",
          analysisDate: a?.created_at ?? null,
          analyzed: !!a,
        };
      });
    },
  });


  const { data: driversList } = useQuery({
    queryKey: ["report-drivers", clientId],
    queryFn: async () => {
      let q = supabase.from("ge_drivers").select("id,client_id,full_name,cpf,license_plate,is_active");
      if (clientId) q = q.eq("client_id", clientId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const driverNameFor = (r: {
    client_id: string;
    driver_ref_id?: string | null;
    driver_id?: string | null;
    driver_name?: string | null;
    license_plate?: string | null;
  }) => resolveEventDriver(r, driversList)?.full_name ?? r.driver_name ?? null;

  const filteredRows = (rows ?? []).filter((r) =>
    (driver.trim()
      ? (driverNameFor(r) ?? "").toLowerCase().includes(driver.trim().toLowerCase())
      : true) &&
    (analysisFilter === "analyzed" ? r.analyzed : analysisFilter === "pending" ? !r.analyzed : true),
  );

  const STATUS_LABELS: Record<string, string> = { pending: "Pendente", in_treatment: "Em tratativa", treated: "Tratado", closed: "Fechado" };
  const cellValue = (r: (typeof filteredRows)[number], k: ColKey): string => {
    const t = Array.isArray(r.treatments) && r.treatments.length > 0 ? r.treatments[0] : null;
    switch (k) {
      case "data": return format(new Date(r.event_time), "dd/MM/yyyy HH:mm");
      case "tipo": return EVENT_TYPE_LABELS[r.event_type] ?? r.event_type;
      case "motorista": return driverNameFor(r) ?? "Não identificado";
      case "placa": return r.license_plate ?? "—";
      case "risco": return RISK_LABELS[r.risk_level] ?? r.risk_level;
      case "status": return STATUS_LABELS[r.status] ?? r.status;
      case "tratativa": return t?.treatment_description ?? "—";
      case "respTratativa": return r.treatmentAuthor || "—";
      case "respAnalise": return r.analysisAuthor || "—";
    }
  };
  const activeCols = COLUMNS.filter((c) => cols.includes(c.key));

  const exportReportPdf = async () => {
    const total = filteredRows.length;
    const tratados = filteredRows.filter((r) => r.status === "treated" || r.status === "closed").length;
    const analisados = filteredRows.filter((r) => r.analyzed).length;
    const filtros = [
      plate && `Placa: ${plate}`, driver && `Motorista: ${driver}`,
      risk !== "all" && `Risco: ${RISK_LABELS[risk]}`,
      treatmentFilter !== "all" && (treatmentFilter === "treated" ? "Tratados" : "Não tratados"),
      analysisFilter !== "all" && (analysisFilter === "analyzed" ? "Analisados" : "Pendente análise"),
    ].filter(Boolean).join(" · ") || "Nenhum";
    try {
      await generateReportPdf(
        {
          periodo: `${dateFrom ? format(new Date(dateFrom + "T00:00:00"), "dd/MM/yyyy") : "início"} a ${dateTo ? format(new Date(dateTo + "T00:00:00"), "dd/MM/yyyy") : "hoje"}`,
          filtros, total, tratados, naoTratados: total - tratados, analisados, pendentesAnalise: total - analisados,
          porRisco: Object.entries(RISK_LABELS).map(([k, label]) => ({ label, count: filteredRows.filter((r) => r.risk_level === k).length })),
        },
        activeCols.map((c) => c.label),
        filteredRows.map((r) => activeCols.map((c) => cellValue(r, c.key))),
      );
      toast.success("Relatório PDF gerado");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao gerar relatório PDF");
    }
  };

  const exportCsv = () => {
    const headers = activeCols.map((c) => c.label);
    const lines = filteredRows.map((r) =>
      activeCols.map((c) => `"${cellValue(r, c.key).replace(/[\r\n"]+/g, " ")}"`).join(","),
    );
    const csv = [headers.join(","), ...lines].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `relatorio-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportCombinedPdf = async () => {
    const withTreatment = filteredRows.filter(
      (r) => Array.isArray(r.treatments) && r.treatments.length > 0,
    );
    if (withTreatment.length === 0) {
      toast.error("Nenhum evento com tratativa para exportar");
      return;
    }

    // Fetch client names in one query
    const clientIds = Array.from(new Set(withTreatment.map((r) => r.client_id).filter(Boolean)));
    const clientMap = new Map<string, string>();
    if (clientIds.length > 0) {
      const { data: clientsData } = await supabase
        .from("ge_clients")
        .select("id,name")
        .in("id", clientIds);
      (clientsData ?? []).forEach((c) => clientMap.set(c.id, c.name));
    }

    const payloads: TreatmentPdfPayload[] = withTreatment.map((r) => {
      const t = r.treatments[0];
      const eventTime = new Date(r.event_time);
      const imei = extractField(r.event_data, ["imei", "device_imei", "deviceId", "device_id"]);
      const speedVal = extractField(r.event_data, ["speed", "velocidade", "velocity"]);
      const fenceVal = extractField(r.event_data, ["fence_name", "geofence", "point_name", "fence", "cerca", "ponto_controle"]) ??
        (typeof (r.event_data as Record<string, unknown> | null)?.activeGeofenceName === "string"
          ? String((r.event_data as Record<string, unknown>).activeGeofenceName)
          : null);
      const eventLabel = EVENT_TYPE_LABELS[r.event_type] ?? r.event_type;
      const riskLabel = RISK_LABELS[r.risk_level] ?? r.risk_level;
      return {
        occurrenceNumber: r.id.slice(0, 8).toUpperCase(),
        situacao: riskLabel,
        cliente: clientMap.get(r.client_id) ?? "—",
        identificador: r.license_plate ?? "—",
        imei: imei ?? "—",
        tipo: eventLabel,
        responsavelTratativa: r.treatmentAuthor || "—",
        dataTratativa: new Date(t.created_at),
        responsavelAnalise: r.analysisAuthor || undefined,
        dataAnalise: r.analysisDate ? new Date(r.analysisDate) : undefined,
        pontoControle: fenceVal ?? undefined,
        primeiroAlarme: eventTime,
        ultimoAlarme: eventTime,
        alarmes: [
          {
            dataHora: format(eventTime, "dd/MM/yyyy HH:mm:ss"),
            latitude: r.latitude != null ? String(r.latitude) : "—",
            longitude: r.longitude != null ? String(r.longitude) : "—",
            velocidade: speedVal ? `${speedVal} KM/H` : "—",
          },
        ],
        motorista: driverNameFor(r) ?? "Não Definido",
        motoristaSituacao: riskLabel,
        observacoes: t.treatment_description ?? "—",
        eventIdShort: r.id.slice(0, 8),
      };
    });

    try {
      await generateCombinedTreatmentPdf(payloads);
      toast.success(`PDF gerado com ${payloads.length} tratativa(s)`);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao gerar PDF consolidado");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Relatório Operacional</h1>
          <p className="text-sm text-muted-foreground">Eventos e tratativas do período</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={exportCsv}><Download className="mr-2 h-4 w-4" />Exportar CSV</Button>
          <Popover>
            <PopoverTrigger asChild><Button variant="outline">Colunas ({cols.length})</Button></PopoverTrigger>
            <PopoverContent className="w-64 space-y-2">
              <p className="text-sm font-medium">Colunas para exportação</p>
              {COLUMNS.map((c) => (
                <label key={c.key} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={cols.includes(c.key)}
                    onCheckedChange={(v) => setCols((prev) => (v ? [...prev, c.key] : prev.filter((x) => x !== c.key)))}
                  />
                  {c.label}
                </label>
              ))}
            </PopoverContent>
          </Popover>
          <Button variant="outline" onClick={exportReportPdf}><FileDown className="mr-2 h-4 w-4" />Relatório PDF</Button>
          <Button onClick={exportCombinedPdf}><FileDown className="mr-2 h-4 w-4" />Exportar PDFs</Button>
        </div>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-3">
          <Input placeholder="Placa" value={plate} onChange={(e) => setPlate(e.target.value)} />
          <Input placeholder="Motorista" value={driver} onChange={(e) => setDriver(e.target.value)} />
          <Select value={risk} onValueChange={setRisk}>
            <SelectTrigger><SelectValue placeholder="Grau de risco" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os riscos</SelectItem>
              <SelectItem value="none">Nenhum</SelectItem>
              <SelectItem value="low">Leve</SelectItem>
              <SelectItem value="medium">Moderado</SelectItem>
              <SelectItem value="high">Grave</SelectItem>
              <SelectItem value="critical">Crítico</SelectItem>
            </SelectContent>
          </Select>
          <Select value={treatmentFilter} onValueChange={(v) => setTreatmentFilter(v as TreatmentFilter)}>
            <SelectTrigger><SelectValue placeholder="Tratativa" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="untreated">Não tratados</SelectItem>
              <SelectItem value="treated">Tratados</SelectItem>
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
                {activeCols.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredRows.map((r) => (
                <TableRow key={r.id}>
                  {activeCols.map((c) => (
                    <TableCell key={c.key} className={c.key === "tratativa" ? "max-w-xs truncate" : "text-sm"}>{cellValue(r, c.key)}</TableCell>
                  ))}
                </TableRow>
              ))}
              {filteredRows.length === 0 && (
                <TableRow><TableCell colSpan={Math.max(1, activeCols.length)} className="py-8 text-center text-muted-foreground">Sem dados.</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function OperationalReportGated() {
  return (
    <FeatureGate feature={FEATURES.reportsOperational}>
      <OperationalReport />
    </FeatureGate>
  );
}
