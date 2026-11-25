import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { reverseGeocode } from "@/lib/ge/geocode";
import { generateTreatmentPdf } from "@/lib/ge/event-pdf";
import { resolveEventDriver } from "@/lib/ge/driver-resolution";

import { computeSpeedingDuration, extractSpeedLimitFromFence } from "@/lib/ge/event-utils";

export const Route = createFileRoute("/gestao-eventos/eventos/$id")({
  component: EventDetail,
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

const STATUS_LABELS: Record<string, string> = {
  pending: "Não tratado",
  in_treatment: "Em tratativa",
  treated: "Tratado",
  closed: "Fechado",
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
  // Recurse one level
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") {
      const found = extractField(v, keys);
      if (found) return found;
    }
  }
  return null;
}

function EventDetail() {
  const { id } = Route.useParams();
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"pending" | "in_progress" | "completed">("completed");

  const { data: event } = useQuery({
    queryKey: ["event", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("ge_events").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: client } = useQuery({
    queryKey: ["event-client", event?.client_id],
    enabled: !!event?.client_id,
    queryFn: async () => {
      const { data } = await supabase.from("ge_clients").select("name").eq("id", event!.client_id).single();
      return data;
    },
  });

  // Frota atual do veículo do evento (Evento → Veículo → Frota → Responsáveis)
  const { data: fleet } = useQuery({
    queryKey: ["event-fleet", event?.fleet_id],
    enabled: !!event?.fleet_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ge_fleets")
        .select("id,name,code,location_name,city,state")
        .eq("id", event!.fleet_id!)
        .maybeSingle();
      return data;
    },
  });

  const { data: fleetResponsibles } = useQuery({
    queryKey: ["event-fleet-responsibles", event?.fleet_id],
    enabled: !!event?.fleet_id,
    queryFn: async () => {
      const { data: links } = await supabase
        .from("ge_fleet_responsibles")
        .select("user_id")
        .eq("fleet_id", event!.fleet_id!);
      const ids = (links ?? []).map((l) => l.user_id);
      if (ids.length === 0) return [] as string[];
      const { data: profiles } = await supabase
        .from("ge_profiles")
        .select("id,full_name,email")
        .in("id", ids);
      return (profiles ?? []).map((p) => p.full_name || p.email);
    },
  });

  const fleetLocation =
    [fleet?.location_name, [fleet?.city, fleet?.state].filter(Boolean).join("/")]
      .filter(Boolean)
      .join(" — ") || "—";
  const fleetResponsiblesLabel = (fleetResponsibles ?? []).join(", ") || "—";

  const { data: drivers } = useQuery({
    queryKey: ["client-drivers", event?.client_id],
    enabled: !!event?.client_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("ge_drivers")
        .select("id, client_id, full_name, cpf, license_plate, is_active")
        .eq("client_id", event!.client_id)
        .order("full_name", { ascending: true });
      return data ?? [];
    },
  });

  const activeDrivers = (drivers ?? []).filter((d) => d.is_active);
  const resolvedDriver = event ? resolveEventDriver(event, drivers) : null;
  const driverDisplayName = event ? (resolvedDriver?.full_name ?? event.driver_name ?? null) : null;

  const updateDriver = async (driverId: string) => {
    const d = activeDrivers.find((x) => x.id === driverId);
    if (!d || !event) return;
    const { error } = await supabase
      .from("ge_events")
      .update({ driver_ref_id: d.id, driver_name: d.full_name })
      .eq("id", event.id);
    if (error) return toast.error(error.message);
    toast.success("Motorista vinculado");
    void qc.invalidateQueries({ queryKey: ["event", id] });
    void qc.invalidateQueries({ queryKey: ["events"] });
  };


  const { data: treatments } = useQuery({
    queryKey: ["treatments", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ge_treatments")
        .select("*")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  const [analysisText, setAnalysisText] = useState("");
  const [analysisOpen, setAnalysisOpen] = useState(false);
  const { data: analyses } = useQuery({
    queryKey: ["event-analyses", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("ge_event_analyses")
        .select("id,analysis_description,created_at,analyzed_by_user_id")
        .eq("event_id", id)
        .order("created_at", { ascending: false });
      const rows = data ?? [];
      const ids = Array.from(new Set(rows.map((r) => r.analyzed_by_user_id)));
      const names = new Map<string, string>();
      if (ids.length) {
        const { data: ps } = await supabase.from("ge_profiles").select("id,full_name,email").in("id", ids);
        (ps ?? []).forEach((p) => names.set(p.id, p.full_name || p.email));
      }
      return rows.map((r) => ({ ...r, author: names.get(r.analyzed_by_user_id) ?? "—" }));
    },
  });

  const handleAnalysis = async () => {
    if (!event || !user) return;
    const { error } = await supabase.from("ge_event_analyses").insert({
      event_id: id,
      client_id: event.client_id,
      analyzed_by_user_id: user.id,
      analysis_description: analysisText.trim(),
    });
    if (error) {
      toast.error("Falha ao registrar análise: " + error.message);
      return;
    }
    setAnalysisText("");
    setAnalysisOpen(false);
    void qc.invalidateQueries({ queryKey: ["event-analyses", id] });
    void qc.invalidateQueries({ queryKey: ["events"] });
    toast.success("Análise registrada");
  };

  const { data: address } = useQuery({
    queryKey: ["geocode", event?.latitude, event?.longitude],
    enabled: !!(event?.latitude && event?.longitude),
    staleTime: Infinity,
    queryFn: () => reverseGeocode(event!.latitude!, event!.longitude!),
  });

  const isSpeeding =
    event?.event_type?.toLowerCase().includes("excesso") ||
    event?.event_type === "speeding";
  const durationRawTop = event ? extractField(event.event_data, ["duration_seconds", "duration", "duracao"]) : null;
  const fenceLimit = event ? extractSpeedLimitFromFence(event.event_data) : null;

  const { data: computedDuration, isLoading: isDurationLoading, isFetched: isDurationFetched } = useQuery({
    queryKey: ["event-duration", id],
    enabled: !!event && isSpeeding && !durationRawTop,
    staleTime: 60_000,
    queryFn: () =>
      computeSpeedingDuration({
        eventId: event!.id,
        licensePlate: event!.license_plate,
        eventTime: event!.event_time,
        clientId: event!.client_id,
        speedLimit:
          fenceLimit ??
          (extractField(event!.event_data, ["speed_limit", "limit", "limite"])
            ? Number(extractField(event!.event_data, ["speed_limit", "limit", "limite"]))
            : null),
      }),
  });

  if (!event) return <div className="text-muted-foreground">Carregando...</div>;

  const speed = extractField(event.event_data, ["speed", "max_speed", "velocidade", "velocity"]);
  const speedLimitRaw = extractField(event.event_data, ["speed_limit", "limit", "limite"]);
  const effectiveLimit = speedLimitRaw ?? (fenceLimit != null ? String(fenceLimit) : null);
  const durationRaw = durationRawTop;
  const fence = extractField(event.event_data, ["fence_name", "geofence", "point_name", "fence", "cerca", "ponto_controle"]) ??
    (typeof (event.event_data as Record<string, unknown>)?.activeGeofenceName === "string"
      ? String((event.event_data as Record<string, unknown>).activeGeofenceName)
      : null);

  const speedDisplay = speed
    ? `${speed} km/h${effectiveLimit ? ` (limite ${effectiveLimit} km/h)` : ""}`
    : "—";
  const durationDisplay = durationRaw
    ? `${durationRaw} s`
    : computedDuration
      ? `${computedDuration.isApproximate ? "~" : ""}${computedDuration.durationSeconds} s`
      : isSpeeding && isDurationLoading && !isDurationFetched
        ? "Calculando…"
        : "—";
  const eventLabel = EVENT_TYPE_LABELS[event.event_type] ?? event.event_type;
  const mapsUrl =
    event.latitude && event.longitude
      ? `https://www.google.com/maps?q=${event.latitude},${event.longitude}`
      : null;
  const videoUrl = findVideoUrl(event.event_data);
  const lastTreatmentComment = treatments?.[0]?.treatment_description ?? null;

  const imei = extractField(event.event_data, ["imei", "device_imei", "deviceId", "device_id"]);


  const handleCreate = async () => {
    if (!description.trim() || !user || !profile?.client_id) {
      toast.error("Descrição obrigatória e usuário precisa ter cliente associado");
      return;
    }
    const { data: created, error } = await supabase
      .from("ge_treatments")
      .insert({
        event_id: id,
        client_id: profile.client_id,
        created_by_user_id: user.id,
        treatment_description: description,
        treatment_status: status,
      })
      .select()
      .single();
    if (error) {
      toast.error(error.message);
      return;
    }
    const newEventStatus = status === "completed" ? "treated" : "in_treatment";
    await supabase.from("ge_events").update({ status: newEventStatus }).eq("id", id);

    try {
      const eventTime = new Date(event.event_time);
      await generateTreatmentPdf({
        occurrenceNumber: id.slice(0, 8).toUpperCase(),
        situacao: RISK_LABELS[event.risk_level] ?? event.risk_level,
        cliente: client?.name ?? "—",
        identificador: event.license_plate ?? "—",
        imei: imei ?? "—",
        tipo: eventLabel,
        responsavelTratativa: profile?.full_name ?? user.email ?? "—",
        dataTratativa: new Date(created?.created_at ?? Date.now()),
        responsavelAnalise: analyses?.[0]?.author,
        dataAnalise: analyses?.[0] ? new Date(analyses[0].created_at) : undefined,
        pontoControle: fence ?? undefined,
        primeiroAlarme: eventTime,
        ultimoAlarme: eventTime,
        alarmes: [
          {
            dataHora: format(eventTime, "dd/MM/yyyy HH:mm:ss"),
            latitude: event.latitude != null ? String(event.latitude) : "—",
            longitude: event.longitude != null ? String(event.longitude) : "—",
            velocidade: speed ? `${speed} KM/H` : "—",
          },
        ],
        motorista: driverDisplayName ?? "Não Definido",
        frota: fleet?.name ?? "—",
        localAtuacao: fleetLocation,
        responsavelFrota: fleetResponsiblesLabel,
        motoristaSituacao: RISK_LABELS[event.risk_level] ?? event.risk_level,
        observacoes: description,
        eventIdShort: id.slice(0, 8),
      });
    } catch (err) {
      console.error(err);
      toast.error("Tratativa registrada, mas falhou ao gerar PDF");
    }


    setDescription("");
    void qc.invalidateQueries({ queryKey: ["treatments", id] });
    void qc.invalidateQueries({ queryKey: ["event", id] });
    toast.success("Tratativa registrada");
  };

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link to="/gestao-eventos/eventos">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Voltar
        </Link>
      </Button>
      <div>
        <h1 className="text-2xl font-bold">{eventLabel}</h1>
        <p className="text-sm text-muted-foreground">
          {format(new Date(event.event_time), "dd/MM/yyyy HH:mm:ss")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações do evento</CardTitle>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-x-6 gap-y-3 text-sm md:grid-cols-2">
            <Info label="Nome do cliente" value={client?.name ?? "—"} />
            <Info label="Placa" value={event.license_plate ?? "—"} />
            <Info label="Frota" value={fleet?.name ?? "—"} />
            <Info label="Local de atuação" value={fleetLocation} />
            <Info label="Responsável(is) pela frota" value={fleetResponsiblesLabel} />
            <div>
              <dt className="text-muted-foreground">Motorista</dt>
              <dd className="mt-0.5">
                <Select
                  value={resolvedDriver?.id ?? ""}
                  onValueChange={updateDriver}
                >
                  <SelectTrigger className="h-8">
                    <SelectValue placeholder={driverDisplayName ?? "Não identificado"} />
                  </SelectTrigger>
                  <SelectContent>
                    {activeDrivers.length === 0 && (
                      <div className="px-2 py-1.5 text-xs text-muted-foreground">
                        Nenhum motorista cadastrado.{" "}
                        <Link to="/gestao-eventos/admin/drivers" className="text-primary underline">Cadastrar</Link>
                      </div>
                    )}
                    {activeDrivers.map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.full_name}{d.license_plate ? ` — ${d.license_plate}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {event.driver_name && (
                  <p className="mt-1 text-xs text-muted-foreground">Original da plataforma: {event.driver_name}</p>
                )}
              </dd>
            </div>
            <Info label="Data do evento" value={format(new Date(event.event_time), "dd/MM/yyyy HH:mm:ss")} />
            <div className="md:col-span-2">
              <dt className="text-muted-foreground">Mapa</dt>
              <dd className="mt-0.5">
                {mapsUrl ? (
                  <a
                    href={mapsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline"
                  >
                    {address ?? `${event.latitude}, ${event.longitude}`}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  "—"
                )}
              </dd>
            </div>
            <Info label="Ponto de controle" value={fence ?? "—"} />
            <Info label="Descrição do evento" value={eventLabel} />
            <Info label="Velocidade" value={speedDisplay} />
            <Info label="Duração" value={durationDisplay} />
            <Info label="Gravidade" value={RISK_LABELS[event.risk_level] ?? event.risk_level} />
            <Info label="Status da tratativa" value={STATUS_LABELS[event.status] ?? event.status} />
            {lastTreatmentComment && (
              <div className="md:col-span-2">
                <dt className="text-muted-foreground">Comentário</dt>
                <dd className="mt-0.5 whitespace-pre-wrap">{lastTreatmentComment}</dd>
              </div>
            )}
          </dl>
        </CardContent>
      </Card>

      {videoUrl && (
        <Card>
          <CardHeader>
            <CardTitle>Vídeo do evento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <video controls preload="metadata" className="w-full rounded bg-black" src={videoUrl}>
              Seu navegador não suporta vídeo.
            </video>
            <a href={videoUrl} target="_blank" rel="noreferrer" className="text-xs text-primary underline">
              Abrir vídeo em nova aba
            </a>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Nova tratativa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-2">
            <Label>Descrição</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva a ação tomada"
            />
          </div>
          <div className="space-y-2">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">Pendente</SelectItem>
                <SelectItem value="in_progress">Em progresso</SelectItem>
                <SelectItem value="completed">Tratado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleCreate}>Registrar tratativa</Button>
            <Button variant="outline" onClick={() => setAnalysisOpen((o) => !o)}>Registrar análise</Button>
          </div>
          {analysisOpen && (
            <div className="space-y-2 rounded-md border p-3">
              <Label>Comentário da análise</Label>
              <Textarea value={analysisText} onChange={(e) => setAnalysisText(e.target.value)} placeholder="Descreva a análise realizada" />
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAnalysis}>Salvar análise</Button>
                <Button size="sm" variant="ghost" onClick={() => setAnalysisOpen(false)}>Cancelar</Button>
              </div>
            </div>
          )}
          {(analyses ?? []).length > 0 && (
            <div className="space-y-1 text-sm">
              <p className="font-medium">Análises registradas</p>
              {(analyses ?? []).map((a) => (
                <div key={a.id} className="rounded border p-2">
                  <p className="text-xs text-muted-foreground">
                    {a.author} · {format(new Date(a.created_at), "dd/MM/yyyy HH:mm")}
                  </p>
                  {a.analysis_description && <p>{a.analysis_description}</p>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Histórico de tratativas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {(treatments ?? []).length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhuma tratativa ainda.</p>
          )}
          {(treatments ?? []).map((t) => (
            <div key={t.id} className="rounded border p-3">
              <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                <span>{format(new Date(t.created_at), "dd/MM/yyyy HH:mm")}</span>
                <span>{t.treatment_status}</span>
              </div>
              <div className="mb-1 text-xs text-muted-foreground">
                Frota: {t.fleet_name ?? "—"} · Veículo: {t.vehicle_identifier ?? "—"}
                {Array.isArray(t.fleet_responsibles_snapshot) && t.fleet_responsibles_snapshot.length > 0
                  ? ` · Responsável(is): ${(t.fleet_responsibles_snapshot as { name?: string }[]).map((r) => r.name).filter(Boolean).join(", ")}`
                  : ""}
              </div>
              <p className="text-sm">{t.treatment_description}</p>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

const VIDEO_KEY_HINTS = ["video", "media", "clip", "evidence", "movie", "stream", "recording"];
const VIDEO_EXT = /\.(mp4|webm|m3u8|mov|mkv|avi|ogv)(\?|#|$)/i;

function findVideoUrl(data: unknown, depth = 0): string | null {
  if (!data || depth > 5) return null;
  if (typeof data === "string") {
    if (/^https?:\/\//i.test(data) && VIDEO_EXT.test(data)) return data;
    return null;
  }
  if (Array.isArray(data)) {
    for (const item of data) {
      const found = findVideoUrl(item, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof data === "object") {
    const obj = data as Record<string, unknown>;
    for (const [k, v] of Object.entries(obj)) {
      const key = k.toLowerCase();
      if (typeof v === "string" && /^https?:\/\//i.test(v)) {
        if (VIDEO_KEY_HINTS.some((h) => key.includes(h)) || VIDEO_EXT.test(v)) return v;
      }
    }
    for (const v of Object.values(obj)) {
      const found = findVideoUrl(v, depth + 1);
      if (found) return found;
    }
  }
  return null;
}
