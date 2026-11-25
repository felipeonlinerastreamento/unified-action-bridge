import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { geDb as supabase } from "@/lib/ge/db";
import { useAuth } from "@/lib/ge/auth";
import { FEATURES, useFeatures } from "@/lib/ge/features";
import { FeatureGate } from "@/components/ge/feature-gate";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2, Pencil, Check, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/gestao-eventos/admin/risk-config")({
  component: RiskConfig,
});

type RiskLevel = "none" | "low" | "medium" | "high" | "critical";

const RISK_LEVELS: { value: RiskLevel; label: string }[] = [
  { value: "none", label: "Nenhum" },
  { value: "low", label: "Leve" },
  { value: "medium", label: "Moderado" },
  { value: "high", label: "Grave" },
  { value: "critical", label: "Crítico" },
];

type ApiSource = "movias" | "yuv";

const SPEEDING_PATTERNS = ["excesso de velocidade", "speeding", "over speed", "overspeed", "velocidade"];

function isSpeedingType(t: string) {
  const s = t.toLowerCase();
  return SPEEDING_PATTERNS.some((p) => s.includes(p));
}

function useAvailableEventTypes(clientId: string, apiSource: ApiSource, category: "telemetry" | "fatigue") {
  return useQuery({
    queryKey: ["risk-config-event-types", clientId, apiSource, category],
    queryFn: async () => {
      const [unmatched, clientTypes, existing] = await Promise.all([
        supabase.from("ge_unmatched_event_type_settings").select("event_type").eq("api_source", apiSource),
        supabase.from("ge_client_event_type_settings").select("event_type").eq("api_source", apiSource).eq("client_id", clientId),
        supabase.from("ge_risk_configurations").select("event_type").eq("client_id", clientId).eq("category", category),
      ]);
      const set = new Set<string>();
      for (const r of unmatched.data ?? []) if (r.event_type) set.add(r.event_type);
      for (const r of clientTypes.data ?? []) if (r.event_type) set.add(r.event_type);
      for (const r of existing.data ?? []) if (r.event_type) set.add(r.event_type);
      const list = Array.from(set);
      const scoped = category === "fatigue" ? list.filter((t) => !isSpeedingType(t)) : list;
      return scoped.sort((a, b) => a.localeCompare(b));
    },
  });
}


function riskLabel(v: string | null) {
  return RISK_LEVELS.find((r) => r.value === v)?.label ?? v ?? "—";
}

function RiskConfig() {
  const { profile } = useAuth();
  const { has } = useFeatures();
  const clientId = profile?.client_id;

  if (!clientId) return <div className="text-muted-foreground">Você precisa estar associado a um cliente.</div>;

  const showTelemetry = has(FEATURES.riskTelemetry);
  const showFatigue = has(FEATURES.riskFatigue);

  return (
    <FeatureGate feature={FEATURES.risk}>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Categorização de Risco</h1>
          <p className="text-sm text-muted-foreground">
            Defina faixas de risco para eventos de telemetria (% acima do limite + duração)
            {showFatigue ? " e fadiga (contagem de ocorrências)" : ""}.
          </p>
        </div>
        <Tabs defaultValue={showTelemetry ? "telemetry" : "fatigue"}>
          <TabsList>
            {showTelemetry && <TabsTrigger value="telemetry">Telemetria</TabsTrigger>}
            {showFatigue && <TabsTrigger value="fatigue">Fadiga</TabsTrigger>}
          </TabsList>
          {showTelemetry && (
            <TabsContent value="telemetry" className="space-y-4">
              <TelemetryTab clientId={clientId} />
            </TabsContent>
          )}
          {showFatigue && (
            <TabsContent value="fatigue" className="space-y-4">
              <FatigueTab clientId={clientId} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </FeatureGate>
  );
}

function useRules(clientId: string, category: "telemetry" | "fatigue") {
  return useQuery({
    queryKey: ["risk-config", clientId, category],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ge_risk_configurations")
        .select("*")
        .eq("client_id", clientId)
        .eq("category", category)
        .order("event_type", { ascending: true })
        .order("priority", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

function groupBy<T extends { event_type: string }>(rows: T[]): Record<string, T[]> {
  return rows.reduce<Record<string, T[]>>((acc, r) => {
    (acc[r.event_type] ??= []).push(r);
    return acc;
  }, {});
}

function TelemetryTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: rules } = useRules(clientId, "telemetry");
  const { data: availableTypes = [] } = useAvailableEventTypes(clientId, "movias", "telemetry");
  const [eventType, setEventType] = useState("");
  const [minPct, setMinPct] = useState<string>("0");
  const [maxPct, setMaxPct] = useState<string>("10");
  const [minDuration, setMinDuration] = useState<string>("0");
  const [risk, setRisk] = useState<RiskLevel>("none");

  const grouped = useMemo(() => groupBy(rules ?? []), [rules]);

  const create = async () => {
    if (!eventType.trim()) return toast.error("Informe o tipo de evento");
    const mn = Number(minPct);
    const mx = Number(maxPct);
    if (Number.isNaN(mn) || Number.isNaN(mx) || mn < 0 || mx <= mn) {
      return toast.error("Faixa de % inválida (mínimo < máximo)");
    }
    const { error } = await supabase.from("ge_risk_configurations").insert({
      client_id: clientId,
      category: "telemetry",
      rule_type: "range_duration",
      event_type: eventType.trim(),
      min_percent: mn,
      max_percent: mx,
      min_duration_seconds: Number(minDuration) || 0,
      risk_level: risk,
      priority: mn,
    });
    if (error) return toast.error(error.message);
    toast.success("Faixa adicionada");
    setEventType("");
    void qc.invalidateQueries({ queryKey: ["risk-config", clientId, "telemetry"] });
    void qc.invalidateQueries({ queryKey: ["risk-config-event-types", clientId, "movias", "telemetry"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ge_risk_configurations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["risk-config", clientId, "telemetry"] });
  };

  const update = async (id: string, patch: { min_percent?: number; max_percent?: number; min_duration_seconds?: number; risk_level?: RiskLevel; min_count?: number; max_count?: number; priority?: number }) => {
    const { error } = await supabase.from("ge_risk_configurations").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Faixa atualizada");
    void qc.invalidateQueries({ queryKey: ["risk-config", clientId, "telemetry"] });
    return true;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nova faixa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-6">
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Tipo de evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder={availableTypes.length ? "Selecione o tipo de evento" : "Nenhum tipo detectado ainda"} />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">% mínimo</Label>
            <Input type="number" value={minPct} onChange={(e) => setMinPct(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">% máximo</Label>
            <Input type="number" value={maxPct} onChange={(e) => setMaxPct(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Duração mín. (s)</Label>
            <Input type="number" value={minDuration} onChange={(e) => setMinDuration(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Nível de risco</Label>
            <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-6">
            <Button onClick={create}>Adicionar faixa</Button>
          </div>
        </CardContent>
      </Card>

      {Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sem faixas configuradas.</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([type, rows]) => (
          <Card key={type}>
            <CardHeader><CardTitle className="text-base">{type}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>% mínimo</TableHead>
                    <TableHead>% máximo</TableHead>
                    <TableHead>Duração mín.</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TelemetryRow key={r.id} row={r} onSave={update} onRemove={remove} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}

function FatigueTab({ clientId }: { clientId: string }) {
  const qc = useQueryClient();
  const { data: rules } = useRules(clientId, "fatigue");
  const { data: availableTypes = [] } = useAvailableEventTypes(clientId, "yuv", "fatigue");
  const [eventType, setEventType] = useState("");
  const [minCount, setMinCount] = useState<string>("1");
  const [maxCount, setMaxCount] = useState<string>("3");
  const [risk, setRisk] = useState<RiskLevel>("low");

  const grouped = useMemo(() => groupBy(rules ?? []), [rules]);

  const create = async () => {
    if (!eventType.trim()) return toast.error("Informe o tipo de evento");
    const mn = Number(minCount);
    const mx = Number(maxCount);
    if (Number.isNaN(mn) || Number.isNaN(mx) || mn < 0 || mx < mn) {
      return toast.error("Faixa de contagem inválida");
    }
    const { error } = await supabase.from("ge_risk_configurations").insert({
      client_id: clientId,
      category: "fatigue",
      rule_type: "count",
      event_type: eventType.trim(),
      min_count: mn,
      max_count: mx,
      risk_level: risk,
      priority: mn,
    });
    if (error) return toast.error(error.message);
    toast.success("Faixa adicionada");
    setEventType("");
    void qc.invalidateQueries({ queryKey: ["risk-config", clientId, "fatigue"] });
    void qc.invalidateQueries({ queryKey: ["risk-config-event-types", clientId, "yuv", "fatigue"] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("ge_risk_configurations").delete().eq("id", id);
    if (error) return toast.error(error.message);
    void qc.invalidateQueries({ queryKey: ["risk-config", clientId, "fatigue"] });
  };

  const update = async (id: string, patch: { min_count?: number; max_count?: number; risk_level?: RiskLevel; priority?: number }) => {
    const { error } = await supabase.from("ge_risk_configurations").update(patch).eq("id", id);
    if (error) { toast.error(error.message); return false; }
    toast.success("Faixa atualizada");
    void qc.invalidateQueries({ queryKey: ["risk-config", clientId, "fatigue"] });
    return true;
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle>Nova faixa</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-5">
          <div className="md:col-span-2">
            <Label className="mb-1 block text-xs">Tipo de evento</Label>
            <Select value={eventType} onValueChange={setEventType}>
              <SelectTrigger>
                <SelectValue placeholder={availableTypes.length ? "Selecione o tipo de evento" : "Nenhum tipo detectado ainda"} />
              </SelectTrigger>
              <SelectContent>
                {availableTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="mb-1 block text-xs">Ocorrências mín.</Label>
            <Input type="number" value={minCount} onChange={(e) => setMinCount(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Ocorrências máx.</Label>
            <Input type="number" value={maxCount} onChange={(e) => setMaxCount(e.target.value)} />
          </div>
          <div>
            <Label className="mb-1 block text-xs">Nível de risco</Label>
            <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-5">
            <Button onClick={create}>Adicionar faixa</Button>
          </div>
        </CardContent>
      </Card>

      {Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-6 text-center text-sm text-muted-foreground">Sem faixas configuradas.</CardContent></Card>
      ) : (
        Object.entries(grouped).map(([type, rows]) => (
          <Card key={type}>
            <CardHeader><CardTitle className="text-base">{type}</CardTitle></CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ocorrências mín.</TableHead>
                    <TableHead>Ocorrências máx.</TableHead>
                    <TableHead>Risco</TableHead>
                    <TableHead className="w-12"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <FatigueRow key={r.id} row={r} onSave={update} onRemove={remove} />
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ))
      )}
    </>
  );
}

type RuleRow = {
  id: string;
  min_percent: number | null;
  max_percent: number | null;
  min_duration_seconds: number | null;
  min_count: number | null;
  max_count: number | null;
  risk_level: string | null;
};

function TelemetryRow({
  row,
  onSave,
  onRemove,
}: {
  row: RuleRow;
  onSave: (id: string, patch: { min_percent?: number; max_percent?: number; min_duration_seconds?: number; risk_level?: RiskLevel; priority?: number }) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [minP, setMinP] = useState(String(row.min_percent ?? 0));
  const [maxP, setMaxP] = useState(String(row.max_percent ?? 0));
  const [dur, setDur] = useState(String(row.min_duration_seconds ?? 0));
  const [risk, setRisk] = useState<RiskLevel>((row.risk_level as RiskLevel) ?? "none");

  const start = () => {
    setMinP(String(row.min_percent ?? 0));
    setMaxP(String(row.max_percent ?? 0));
    setDur(String(row.min_duration_seconds ?? 0));
    setRisk((row.risk_level as RiskLevel) ?? "none");
    setEditing(true);
  };

  const save = async () => {
    const mn = Number(minP);
    const mx = Number(maxP);
    if (Number.isNaN(mn) || Number.isNaN(mx) || mn < 0 || mx <= mn) {
      return toast.error("Faixa de % inválida (mínimo < máximo)");
    }
    const ok = await onSave(row.id, {
      min_percent: mn,
      max_percent: mx,
      min_duration_seconds: Number(dur) || 0,
      risk_level: risk,
      priority: mn,
    });
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{row.min_percent ?? "—"}%</TableCell>
        <TableCell>{row.max_percent ?? "—"}%</TableCell>
        <TableCell>{row.min_duration_seconds != null ? `≥ ${row.min_duration_seconds} s` : "—"}</TableCell>
        <TableCell>{riskLabel(row.risk_level)}</TableCell>
        <TableCell className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={start} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell><Input type="number" value={minP} onChange={(e) => setMinP(e.target.value)} className="h-8" /></TableCell>
      <TableCell><Input type="number" value={maxP} onChange={(e) => setMaxP(e.target.value)} className="h-8" /></TableCell>
      <TableCell><Input type="number" value={dur} onChange={(e) => setDur(e.target.value)} className="h-8" /></TableCell>
      <TableCell>
        <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel)}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={save} aria-label="Salvar">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

function FatigueRow({
  row,
  onSave,
  onRemove,
}: {
  row: RuleRow;
  onSave: (id: string, patch: { min_count?: number; max_count?: number; risk_level?: RiskLevel; priority?: number }) => Promise<boolean>;
  onRemove: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [minC, setMinC] = useState(String(row.min_count ?? 0));
  const [maxC, setMaxC] = useState(String(row.max_count ?? 0));
  const [risk, setRisk] = useState<RiskLevel>((row.risk_level as RiskLevel) ?? "low");

  const start = () => {
    setMinC(String(row.min_count ?? 0));
    setMaxC(String(row.max_count ?? 0));
    setRisk((row.risk_level as RiskLevel) ?? "low");
    setEditing(true);
  };

  const save = async () => {
    const mn = Number(minC);
    const mx = Number(maxC);
    if (Number.isNaN(mn) || Number.isNaN(mx) || mn < 0 || mx < mn) {
      return toast.error("Faixa de contagem inválida");
    }
    const ok = await onSave(row.id, {
      min_count: mn,
      max_count: mx,
      risk_level: risk,
      priority: mn,
    });
    if (ok) setEditing(false);
  };

  if (!editing) {
    return (
      <TableRow>
        <TableCell>{row.min_count ?? "—"}</TableCell>
        <TableCell>{row.max_count ?? "—"}</TableCell>
        <TableCell>{riskLabel(row.risk_level)}</TableCell>
        <TableCell className="flex gap-1">
          <Button size="icon" variant="ghost" onClick={start} aria-label="Editar">
            <Pencil className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => onRemove(row.id)} aria-label="Remover">
            <Trash2 className="h-4 w-4" />
          </Button>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <TableRow>
      <TableCell><Input type="number" value={minC} onChange={(e) => setMinC(e.target.value)} className="h-8" /></TableCell>
      <TableCell><Input type="number" value={maxC} onChange={(e) => setMaxC(e.target.value)} className="h-8" /></TableCell>
      <TableCell>
        <Select value={risk} onValueChange={(v) => setRisk(v as RiskLevel)}>
          <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            {RISK_LEVELS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </TableCell>
      <TableCell className="flex gap-1">
        <Button size="icon" variant="ghost" onClick={save} aria-label="Salvar">
          <Check className="h-4 w-4" />
        </Button>
        <Button size="icon" variant="ghost" onClick={() => setEditing(false)} aria-label="Cancelar">
          <X className="h-4 w-4" />
        </Button>
      </TableCell>
    </TableRow>
  );
}
